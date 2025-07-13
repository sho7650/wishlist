// src/adapters/primary/KoaWishAdapter.ts
import Koa from "koa";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";
import { GetUserWishUseCase } from "../../application/usecases/GetUserWishUseCase";
import { SupportWishUseCase } from "../../application/usecases/SupportWishUseCase";
import { UnsupportWishUseCase } from "../../application/usecases/UnsupportWishUseCase";
import { GetWishSupportStatusUseCase } from "../../application/usecases/GetWishSupportStatusUseCase";
import { v4 as uuidv4 } from 'uuid';
interface WishRequestBody {
  name?: string;
  wish?: string;
}

export class KoaWishAdapter {
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
  private ensureSessionId(ctx: Koa.Context, userId?: number): string {
    let sessionId = ctx.cookies.get("sessionId");
    
    // 匿名ユーザーでセッションIDが無い場合は新しいセッションIDを生成
    if (!sessionId && !userId) {
      sessionId = uuidv4();
      
      // セッションIDをクッキーに設定
      ctx.cookies.set("sessionId", sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict" as const,
        secure: false, // 開発環境ではHTTPでも動作するように
      });
      
    }
    
    return sessionId || "";
  }

  public createWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { name, wish } = ctx.request.body as WishRequestBody;
      if (!wish) {
        /* ... */ return;
      }

      const sessionId = ctx.cookies.get("sessionId");
      // ★ ユーザーIDを ctx.state.user から取得
      const userId = ctx.state.user?.id;

      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId,
        userId
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
      const userId = ctx.state.user?.id;
      const sessionId = ctx.cookies.get("sessionId");

      if (!userId && !sessionId) {
        ctx.status = 401;
        ctx.body = { error: "編集権限がありません" };
        return;
      }
      if (!wish) {
        ctx.status = 400;
        ctx.body = { error: "願い事は必須です" };
        return;
      }
      // ユースケースに両方のIDを渡す
      await this.updateWishUseCase.execute(name, wish, userId, sessionId);

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
      const userId = ctx.state.user?.id;
      
      // セッションIDを確保
      const sessionId = this.ensureSessionId(ctx, userId);
      
      // 応援状況を含めて取得
      const wishes = await this.getLatestWishesUseCase.executeWithSupportStatus(
        limit, 
        offset, 
        sessionId, 
        userId
      );
      
      ctx.status = 200;
      ctx.body = { wishes };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };
  
  public getUserWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const userId = ctx.state.user?.id;
      const sessionId = ctx.cookies.get("sessionId");
      const wish = await this.getUserWishUseCase.execute(userId, sessionId);
      ctx.status = 200;
      ctx.body = { wish };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public supportWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { wishId } = ctx.params;
      const userId = ctx.state.user?.id;
      
      if (!wishId) {
        ctx.status = 400;
        ctx.body = { error: "願い事IDが必要です" };
        return;
      }

      // セッションIDを確保
      const sessionId = this.ensureSessionId(ctx, userId);

      const result = await this.supportWishUseCase.execute(wishId, sessionId, userId);

      if (result.alreadySupported) {
        ctx.status = 200;
        ctx.body = { 
          message: "既に応援済みです", 
          success: true, 
          alreadySupported: true 
        };
        return;
      }

      ctx.status = 200;
      ctx.body = { 
        message: "応援しました", 
        success: true, 
        alreadySupported: false 
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public unsupportWish = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { wishId } = ctx.params;
      const userId = ctx.state.user?.id;
      
      if (!wishId) {
        ctx.status = 400;
        ctx.body = { error: "願い事IDが必要です" };
        return;
      }

      // セッションIDを確保
      const sessionId = this.ensureSessionId(ctx, userId);

      const result = await this.unsupportWishUseCase.execute(wishId, sessionId, userId);

      if (!result.wasSupported) {
        ctx.status = 400;
        ctx.body = { error: "応援していません" };
        return;
      }

      ctx.status = 200;
      ctx.body = { message: "応援を取り消しました", success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };

  public getWishSupportStatus = async (ctx: Koa.Context): Promise<void> => {
    try {
      const { wishId } = ctx.params;
      const userId = ctx.state.user?.id;
      
      if (!wishId) {
        ctx.status = 400;
        ctx.body = { error: "願い事IDが必要です" };
        return;
      }

      // セッションIDを確保
      const sessionId = this.ensureSessionId(ctx, userId);

      const result = await this.getWishSupportStatusUseCase.execute(wishId, sessionId, userId);

      ctx.status = 200;
      ctx.body = {
        isSupported: result.isSupported,
        wish: result.wish,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      ctx.status = 400;
      ctx.body = { error: errorMessage };
    }
  };
}
