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
import { BaseWishController, ControllerContext, ControllerResponse } from "./BaseWishController";
interface WishRequestBody {
  name?: string;
  wish?: string;
}

export class KoaWishAdapter {
  private baseController: BaseWishController;

  constructor(
    createWishUseCase: CreateWishUseCase,
    updateWishUseCase: UpdateWishUseCase,
    getWishBySessionUseCase: GetWishBySessionUseCase,
    getLatestWishesUseCase: GetLatestWishesUseCase,
    getUserWishUseCase: GetUserWishUseCase,
    supportWishUseCase: SupportWishUseCase,
    unsupportWishUseCase: UnsupportWishUseCase,
    getWishSupportStatusUseCase: GetWishSupportStatusUseCase
  ) {
    this.baseController = new BaseWishController(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase,
      getUserWishUseCase,
      supportWishUseCase,
      unsupportWishUseCase,
      getWishSupportStatusUseCase
    );
  }

  /**
   * Convert Koa context to framework-agnostic context
   */
  private createContext(ctx: Koa.Context): ControllerContext {
    return {
      sessionId: ctx.cookies.get("sessionId"),
      userId: ctx.state.user?.id,
      body: ctx.request.body,
      params: ctx.params,
      query: ctx.query
    };
  }

  /**
   * Apply controller response to Koa context
   */
  private applyResponse(controllerResponse: ControllerResponse, ctx: Koa.Context): void {
    if (controllerResponse.sessionId) {
      ctx.cookies.set("sessionId", controllerResponse.sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict" as const,
        secure: false, // 開発環境ではHTTPでも動作するように
      });
    }
    
    ctx.status = controllerResponse.statusCode;
    ctx.body = controllerResponse.body;
  }

  public createWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.createWish(context);
    this.applyResponse(response, ctx);
  };

  public updateWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.updateWish(context);
    this.applyResponse(response, ctx);
  };

  public getCurrentWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.getCurrentWish(context);
    this.applyResponse(response, ctx);
  };

  public getLatestWishes = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.getLatestWishes(context);
    this.applyResponse(response, ctx);
  };
  
  public getUserWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.getUserWish(context);
    this.applyResponse(response, ctx);
  };

  public supportWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.supportWish(context);
    this.applyResponse(response, ctx);
  };

  public unsupportWish = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.unsupportWish(context);
    this.applyResponse(response, ctx);
  };

  public getWishSupportStatus = async (ctx: Koa.Context): Promise<void> => {
    const context = this.createContext(ctx);
    const response = await this.baseController.getWishSupportStatus(context);
    this.applyResponse(response, ctx);
  };
}
