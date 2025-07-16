import { Request, Response } from "express";
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";
import { GetUserWishUseCase } from "../../application/usecases/GetUserWishUseCase";
import { SupportWishUseCase } from "../../application/usecases/SupportWishUseCase";
import { UnsupportWishUseCase } from "../../application/usecases/UnsupportWishUseCase";
import { GetWishSupportStatusUseCase } from "../../application/usecases/GetWishSupportStatusUseCase";
import { BaseWishController, ControllerContext, ControllerResponse } from "./BaseWishController";

export class WishController {
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
   * Convert Express request to framework-agnostic context
   */
  private createContext(req: Request): ControllerContext {
    return {
      sessionId: req.cookies.sessionId,
      userId: req.user?.id,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }

  /**
   * Apply controller response to Express response
   */
  private applyResponse(controllerResponse: ControllerResponse, res: Response): void {
    if (controllerResponse.sessionId) {
      res.cookie("sessionId", controllerResponse.sessionId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
        sameSite: "strict",
      });
    }
    
    res.status(controllerResponse.statusCode).json(controllerResponse.body);
  }

  public createWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.createWish(context);
    this.applyResponse(response, res);
  };

  public updateWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.updateWish(context);
    this.applyResponse(response, res);
  };

  public getCurrentWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.getCurrentWish(context);
    this.applyResponse(response, res);
  };

  public getLatestWishes = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.getLatestWishes(context);
    this.applyResponse(response, res);
  };

  public getUserWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.getUserWish(context);
    this.applyResponse(response, res);
  };

  public supportWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.supportWish(context);
    this.applyResponse(response, res);
  };

  public unsupportWish = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.unsupportWish(context);
    this.applyResponse(response, res);
  };

  public getWishSupportStatus = async (req: Request, res: Response): Promise<void> => {
    const context = this.createContext(req);
    const response = await this.baseController.getWishSupportStatus(context);
    this.applyResponse(response, res);
  };
}
