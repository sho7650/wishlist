import { Request, Response, NextFunction } from "express";
import { AuthenticationPort } from "../../ports/AuthenticationPort";
import { BaseAuthenticationAdapter } from "./BaseAuthenticationAdapter";

/**
 * Express.js authentication adapter
 * Bridges between Express/Passport and the authentication service
 */
export class ExpressAuthenticationAdapter extends BaseAuthenticationAdapter {
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
  requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (this.isAuthenticated(req)) {
      this.logDebug("User authenticated", { 
        userId: this.getUser(req) ? (this.getUser(req) as any).id : 'unknown' 
      });
      next();
    } else {
      this.logWarn("Unauthenticated access attempt");
      this.sendUnauthorizedResponse(res);
    }
  }

  /**
   * Middleware to get current user (optional authentication)
   */
  getCurrentUser(req: Request, res: Response, next: NextFunction): void {
    if (this.isAuthenticated(req)) {
      this.logDebug("Current user available", { 
        userId: this.getUser(req) ? (this.getUser(req) as any).id : 'unknown' 
      });
    } else {
      this.logDebug("No current user (anonymous access)");
    }
    next();
  }

  /**
   * Express-specific authentication check
   */
  protected isAuthenticated(req: Request): boolean {
    return req.isAuthenticated();
  }

  /**
   * Express-specific user extraction
   */
  protected getUser(req: Request): any {
    return req.user;
  }

  /**
   * Express-specific unauthorized response
   */
  protected sendUnauthorizedResponse(res: Response): void {
    res.status(401).json({ error: "認証が必要です" });
  }

  /**
   * Express-specific logging prefix
   */
  protected getLogPrefix(): string {
    return "EXPRESS_AUTH";
  }
}