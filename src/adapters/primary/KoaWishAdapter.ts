// src/adapters/primary/KoaWishAdapter.ts
import Koa from "koa";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";

interface WishRequestBody {
  name?: string;
  wish?: string;
}

export class KoaWishAdapter {
  constructor(
    private createWishUseCase: CreateWishUseCase,
    private updateWishUseCase: UpdateWishUseCase,
    private getWishBySessionUseCase: GetWishBySessionUseCase,
    private getLatestWishesUseCase: GetLatestWishesUseCase
  ) {}

  public createWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { name, wish } = ctx.request.body as WishRequestBody;
      if (!wish) {
        ctx.status = 400;
        ctx.body = { error: "願い事は必須です" };
        return;
      }
      const sessionId = ctx.cookies.get("sessionId");
      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId
      );
      ctx.cookies.set("sessionId", result.sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: "strict",
      });
      ctx.status = 201;
      ctx.body = { wish: result.wish };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public updateWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { name, wish } = ctx.request.body as WishRequestBody;
      const sessionId = ctx.cookies.get("sessionId");
      if (!sessionId) {
        ctx.status = 401;
        ctx.body = { error: "編集権限がありません" };
        return;
      }
      if (!wish) {
        ctx.status = 400;
        ctx.body = { error: "願い事は必須です" };
        return;
      }
      await this.updateWishUseCase.execute(sessionId, name, wish);
      ctx.status = 200;
      ctx.body = { message: "更新しました" };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public getCurrentWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const sessionId = ctx.cookies.get("sessionId");
      if (!sessionId) {
        ctx.status = 200;
        ctx.body = { wish: null };
        return;
      }
      const wish = await this.getWishBySessionUseCase.execute(sessionId);
      ctx.status = 200;
      ctx.body = { wish };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public getLatestWishes = async (ctx: Koa.Context): Promise<void> => {
    try {
      const limit = parseInt(ctx.query.limit as string, 10) || 20;
      const offset = parseInt(ctx.query.offset as string, 10) || 0;
      const wishes = await this.getLatestWishesUseCase.execute(limit, offset);
      ctx.status = 200;
      ctx.body = { wishes };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };
}
