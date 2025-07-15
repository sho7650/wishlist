import { Request, Response } from "express";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";
import { GetUserWishUseCase } from "../../application/usecases/GetUserWishUseCase";
import { SupportWishUseCase } from "../../application/usecases/SupportWishUseCase";
import { UnsupportWishUseCase } from "../../application/usecases/UnsupportWishUseCase";
import { GetWishSupportStatusUseCase } from "../../application/usecases/GetWishSupportStatusUseCase";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../../utils/Logger";

export class WishController {
  constructor(
    private createWishUseCase: CreateWishUseCase,
    private updateWishUseCase: UpdateWishUseCase,
    private getWishBySessionUseCase: GetWishBySessionUseCase,
    private getLatestWishesUseCase: GetLatestWishesUseCase,
    private getUserWishUseCase: GetUserWishUseCase,
    private supportWishUseCase: SupportWishUseCase,
    private unsupportWishUseCase: UnsupportWishUseCase,
    private getWishSupportStatusUseCase: GetWishSupportStatusUseCase
  ) {}

  /**
   * 匿名ユーザーのセッションIDを確保する
   * 既存のセッションIDがある場合はそれを使用し、無い場合は新しく生成する
   */
  private ensureSessionId(
    req: Request,
    res: Response,
    userId?: number
  ): string {
    let sessionId = req.cookies.sessionId;

    // 匿名ユーザーでセッションIDが無い場合は新しいセッションIDを生成
    if (!sessionId && !userId) {
      sessionId = uuidv4();

      // セッションIDをクッキーに設定
      res.cookie("sessionId", sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict",
      });
    }

    return sessionId;
  }

  public createWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, wish } = req.body;
      Logger.debug("[CONTROLLER] Creating wish", {
        name: name?.substring(0, 20),
        wish: wish?.substring(0, 50),
      });

      if (!wish) {
        res.status(400).json({ error: "願い事は必須です" });
        return;
      }

      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;
      Logger.debug("[CONTROLLER] User info", { sessionId, userId });

      // 投稿を作成
      Logger.debug("[CONTROLLER] Calling createWishUseCase.execute");
      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId,
        userId
      );
      Logger.debug("[CONTROLLER] createWishUseCase.execute completed successfully");

      // Cookieを設定
      res.cookie("sessionId", result.sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict",
      });

      Logger.debug("[CONTROLLER] Sending successful response");
      res.status(201).json({ wish: result.wish });
    } catch (error: unknown) {
      Logger.error("[CONTROLLER] Error in createWish", error as Error);
      Logger.debug(
        "[CONTROLLER] Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public updateWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, wish } = req.body;
      const userId = req.user?.id;
      const sessionId = req.cookies.sessionId;

      if (!userId && !sessionId) {
        res.status(401).json({ error: "編集権限がありません。" });
        return;
      }
      if (!wish) {
        res.status(400).json({ error: "願い事は必須です。" });
        return;
      }

      // ユースケースに両方のIDを渡す
      await this.updateWishUseCase.execute(name, wish, userId, sessionId);

      res.status(200).json({ message: "更新しました" });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public getCurrentWish = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const sessionId = req.cookies.sessionId;

      if (!sessionId) {
        res.status(200).json({ wish: null });
        return;
      }

      const wish = await this.getWishBySessionUseCase.execute(sessionId);
      res.status(200).json({ wish });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public getLatestWishes = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      // 応援状況を含めて取得
      const wishes = await this.getLatestWishesUseCase.executeWithSupportStatus(
        limit,
        offset,
        sessionId,
        userId
      );
      res.status(200).json({ wishes });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public getUserWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const sessionId = req.cookies.sessionId;

      const wish = await this.getUserWishUseCase.execute(userId, sessionId);

      if (!wish) {
        res.status(404).json({ error: "願い事が見つかりません" });
        return;
      }

      res.status(200).json({ wish });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public supportWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { wishId } = req.params;
      let sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      // セッションIDを確保
      sessionId = this.ensureSessionId(req, res, userId);

      const result = await this.supportWishUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      if (result.alreadySupported) {
        res.status(200).json({
          message: "既に応援済みです",
          success: true,
          alreadySupported: true,
        });
        return;
      }

      res.status(200).json({
        message: "応援しました",
        success: true,
        alreadySupported: false,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";

      // Handle specific business rule errors with appropriate status codes
      if (errorMessage === "作者は自分の願いに応援できません") {
        res.status(403).json({
          error: errorMessage,
          code: "SELF_SUPPORT_NOT_ALLOWED",
        });
        return;
      }

      if (errorMessage === "願い事が見つかりません") {
        res.status(404).json({ error: errorMessage });
        return;
      }

      res.status(400).json({ error: errorMessage });
    }
  };

  public unsupportWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { wishId } = req.params;
      let sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      // セッションIDを確保
      sessionId = this.ensureSessionId(req, res, userId);

      const result = await this.unsupportWishUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      if (!result.wasSupported) {
        res.status(200).json({
          message: "応援していませんでした",
          success: true,
          wasSupported: false,
        });
        return;
      }

      res.status(200).json({
        message: "応援を取り消しました",
        success: true,
        wasSupported: true,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public getWishSupportStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { wishId } = req.params;
      let sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      // セッションIDを確保
      sessionId = this.ensureSessionId(req, res, userId);

      const result = await this.getWishSupportStatusUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      res.status(200).json({
        isSupported: result.isSupported,
        wish: result.wish,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };
}
