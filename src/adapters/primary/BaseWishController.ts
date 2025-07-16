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

/**
 * Framework-agnostic controller parameters
 */
export interface ControllerContext {
  sessionId?: string;
  userId?: number;
  body?: any;
  params?: any;
  query?: any;
}

/**
 * Framework-agnostic response structure
 */
export interface ControllerResponse {
  statusCode: number;
  body: any;
  sessionId?: string;
}

/**
 * Base controller containing all business logic for wish operations
 * This eliminates ~95% code duplication between Express and Koa controllers
 */
export class BaseWishController {
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
   * Generate new session ID for anonymous users
   */
  private generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Ensure session ID exists for anonymous users
   */
  private ensureSessionId(sessionId?: string, userId?: number): string {
    if (!sessionId && !userId) {
      return this.generateSessionId();
    }
    return sessionId || "";
  }

  /**
   * Create a new wish
   */
  async createWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { name, wish } = context.body || {};
      
      Logger.debug("[BASE_CONTROLLER] Creating wish", {
        name: name?.substring(0, 20),
        wish: wish?.substring(0, 50),
      });

      if (!wish) {
        return {
          statusCode: 400,
          body: { error: "願い事は必須です" }
        };
      }

      const { sessionId, userId } = context;
      Logger.debug("[BASE_CONTROLLER] User info", { sessionId, userId });

      Logger.debug("[BASE_CONTROLLER] Calling createWishUseCase.execute");
      const result = await this.createWishUseCase.execute(
        name,
        wish,
        sessionId,
        userId
      );
      Logger.debug("[BASE_CONTROLLER] createWishUseCase.execute completed successfully");

      Logger.debug("[BASE_CONTROLLER] Sending successful response");
      return {
        statusCode: 201,
        body: { wish: result.wish },
        sessionId: result.sessionId
      };
    } catch (error: unknown) {
      Logger.error("[BASE_CONTROLLER] Error in createWish", error as Error);
      Logger.debug(
        "[BASE_CONTROLLER] Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Update an existing wish
   */
  async updateWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { name, wish } = context.body || {};
      const { userId, sessionId } = context;

      if (!userId && !sessionId) {
        return {
          statusCode: 401,
          body: { error: "編集権限がありません。" }
        };
      }

      if (!wish) {
        return {
          statusCode: 400,
          body: { error: "願い事は必須です。" }
        };
      }

      await this.updateWishUseCase.execute(name, wish, userId, sessionId);

      return {
        statusCode: 200,
        body: { message: "更新しました" }
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Get current user's wish by session
   */
  async getCurrentWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { sessionId } = context;

      if (!sessionId) {
        return {
          statusCode: 200,
          body: { wish: null }
        };
      }

      const wish = await this.getWishBySessionUseCase.execute(sessionId);
      return {
        statusCode: 200,
        body: { wish }
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Get latest wishes with support status
   */
  async getLatestWishes(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { query = {}, userId } = context;
      const limit = parseInt(query.limit as string) || 20;
      const offset = parseInt(query.offset as string) || 0;
      
      // Ensure session ID for support status tracking
      const sessionId = this.ensureSessionId(context.sessionId, userId);

      const wishes = await this.getLatestWishesUseCase.executeWithSupportStatus(
        limit,
        offset,
        sessionId,
        userId
      );

      return {
        statusCode: 200,
        body: { wishes },
        sessionId: sessionId !== context.sessionId ? sessionId : undefined
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Get user's wish
   */
  async getUserWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { userId, sessionId } = context;

      const wish = await this.getUserWishUseCase.execute(userId, sessionId);

      return {
        statusCode: 200,
        body: { wish: wish || null }
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Support a wish
   */
  async supportWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { params = {}, userId } = context;
      const { wishId } = params;

      if (!wishId) {
        return {
          statusCode: 400,
          body: { error: "願い事IDが必要です" }
        };
      }

      // Ensure session ID for anonymous users
      const sessionId = this.ensureSessionId(context.sessionId, userId);

      const result = await this.supportWishUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      if (result.alreadySupported) {
        return {
          statusCode: 200,
          body: {
            message: "既に応援済みです",
            success: true,
            alreadySupported: true,
          },
          sessionId: sessionId !== context.sessionId ? sessionId : undefined
        };
      }

      return {
        statusCode: 200,
        body: {
          message: "応援しました",
          success: true,
          alreadySupported: false,
        },
        sessionId: sessionId !== context.sessionId ? sessionId : undefined
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";

      // Handle specific business rule errors with appropriate status codes
      if (errorMessage === "作者は自分の願いに応援できません") {
        return {
          statusCode: 403,
          body: {
            error: errorMessage,
            code: "SELF_SUPPORT_NOT_ALLOWED",
          }
        };
      }

      if (errorMessage === "願い事が見つかりません") {
        return {
          statusCode: 404,
          body: { error: errorMessage }
        };
      }

      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Unsupport a wish
   */
  async unsupportWish(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { params = {}, userId } = context;
      const { wishId } = params;

      if (!wishId) {
        return {
          statusCode: 400,
          body: { error: "願い事IDが必要です" }
        };
      }

      // Ensure session ID for anonymous users
      const sessionId = this.ensureSessionId(context.sessionId, userId);

      const result = await this.unsupportWishUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      if (!result.wasSupported) {
        return {
          statusCode: 200,
          body: {
            message: "応援していませんでした",
            success: true,
            wasSupported: false,
          },
          sessionId: sessionId !== context.sessionId ? sessionId : undefined
        };
      }

      return {
        statusCode: 200,
        body: {
          message: "応援を取り消しました",
          success: true,
          wasSupported: true,
        },
        sessionId: sessionId !== context.sessionId ? sessionId : undefined
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }

  /**
   * Get wish support status
   */
  async getWishSupportStatus(context: ControllerContext): Promise<ControllerResponse> {
    try {
      const { params = {}, userId } = context;
      const { wishId } = params;

      if (!wishId) {
        return {
          statusCode: 400,
          body: { error: "願い事IDが必要です" }
        };
      }

      // Ensure session ID for anonymous users
      const sessionId = this.ensureSessionId(context.sessionId, userId);

      const result = await this.getWishSupportStatusUseCase.execute(
        wishId,
        sessionId,
        userId
      );

      return {
        statusCode: 200,
        body: {
          isSupported: result.isSupported,
          wish: result.wish,
        },
        sessionId: sessionId !== context.sessionId ? sessionId : undefined
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      return {
        statusCode: 400,
        body: { error: errorMessage }
      };
    }
  }
}