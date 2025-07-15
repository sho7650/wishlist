import { Context, Next } from "koa";
import { AuthenticationPort } from "../../ports/AuthenticationPort";
import { BaseAuthenticationAdapter } from "./BaseAuthenticationAdapter";

/**
 * Koa.js authentication adapter
 * Bridges between Koa/Passport and the authentication service
 */
export class KoaAuthenticationAdapter extends BaseAuthenticationAdapter {
  constructor(authenticationService: AuthenticationPort) {
    super(authenticationService);
  }

  // OAuth callback handling is now inherited from BaseAuthenticationAdapter

  // User serialization is now inherited from BaseAuthenticationAdapter

  // User deserialization is now inherited from BaseAuthenticationAdapter

  // User format conversion is now inherited from BaseAuthenticationAdapter

  // Domain conversion is now inherited from BaseAuthenticationAdapter

  /**
   * Middleware to ensure user is authenticated
   */
  requireAuth(ctx: Context, next: Next): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isAuthenticated(ctx)) {
        this.logDebug("User authenticated", { 
          userId: this.getUser(ctx) ? this.getUser(ctx).id : 'unknown' 
        });
        resolve(next());
      } else {
        this.logWarn("Unauthenticated access attempt");
        this.sendUnauthorizedResponse(ctx);
        resolve();
      }
    });
  }

  /**
   * Middleware to get current user (optional authentication)
   */
  getCurrentUser(ctx: Context, next: Next): Promise<void> {
    return new Promise((resolve) => {
      if (this.isAuthenticated(ctx)) {
        this.logDebug("Current user available", { 
          userId: this.getUser(ctx) ? this.getUser(ctx).id : 'unknown' 
        });
      } else {
        this.logDebug("No current user (anonymous access)");
      }
      resolve(next());
    });
  }

  /**
   * Koa-specific authentication check
   */
  protected isAuthenticated(ctx: Context): boolean {
    return ctx.isAuthenticated();
  }

  /**
   * Koa-specific user extraction
   */
  protected getUser(ctx: Context): any {
    return ctx.state.user;
  }

  /**
   * Koa-specific unauthorized response
   */
  protected sendUnauthorizedResponse(ctx: Context): void {
    ctx.status = 401;
    ctx.body = { error: "認証が必要です" };
  }

  /**
   * Koa-specific logging prefix
   */
  protected getLogPrefix(): string {
    return "KOA_AUTH";
  }
}