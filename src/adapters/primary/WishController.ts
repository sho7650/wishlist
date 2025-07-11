import { Request, Response } from "express";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";
import { GetUserWishUseCase } from "../../application/usecases/GetUserWishUseCase";
import { SupportWishUseCase } from "../../application/usecases/SupportWishUseCase";
import { UnsupportWishUseCase } from "../../application/usecases/UnsupportWishUseCase";
import { GetWishSupportStatusUseCase } from "../../application/usecases/GetWishSupportStatusUseCase";

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

  public createWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, wish } = req.body;

      if (!wish) {
        res.status(400).json({ error: "願い事は必須です" });
        return;
      }

      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;
      // 投稿を作成
      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId,
        userId
      );

      // Cookieを設定
      res.cookie("sessionId", result.sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict",
      });

      res.status(201).json({ wish: result.wish });
    } catch (error: unknown) {
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

      const wishes = await this.getLatestWishesUseCase.execute(limit, offset);
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
      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      const result = await this.supportWishUseCase.execute(wishId, sessionId, userId);

      if (result.alreadySupported) {
        res.status(400).json({ error: "既に応援済みです" });
        return;
      }

      res.status(200).json({ message: "応援しました", success: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public unsupportWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { wishId } = req.params;
      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      const result = await this.unsupportWishUseCase.execute(wishId, sessionId, userId);

      if (!result.wasSupported) {
        res.status(400).json({ error: "応援していません" });
        return;
      }

      res.status(200).json({ message: "応援を取り消しました", success: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      res.status(400).json({ error: errorMessage });
    }
  };

  public getWishSupportStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { wishId } = req.params;
      const sessionId = req.cookies.sessionId;
      const userId = req.user?.id;

      if (!wishId) {
        res.status(400).json({ error: "願い事IDが必要です" });
        return;
      }

      const result = await this.getWishSupportStatusUseCase.execute(wishId, sessionId, userId);

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
