import { Request, Response } from "express";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";

export class WishController {
  constructor(
    private createWishUseCase: CreateWishUseCase,
    private updateWishUseCase: UpdateWishUseCase,
    private getWishBySessionUseCase: GetWishBySessionUseCase,
    private getLatestWishesUseCase: GetLatestWishesUseCase
  ) {}

  public createWish = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, wish } = req.body;

      if (!wish) {
        res.status(400).json({ error: "願い事は必須です" });
        return;
      }

      const sessionId = req.cookies.sessionId;

      // 投稿を作成
      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId
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
      const sessionId = req.cookies.sessionId;

      if (!sessionId) {
        res.status(401).json({ error: "編集権限がありません" });
        return;
      }

      if (!wish) {
        res.status(400).json({ error: "願い事は必須です" });
        return;
      }

      await this.updateWishUseCase.execute(sessionId, name, wish);
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
}
