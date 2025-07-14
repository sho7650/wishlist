import { Request, Response, NextFunction } from "express";
import { AuthenticationPort } from "../../ports/AuthenticationPort";
import { GoogleProfile } from "../../domain/auth/GoogleProfile";
import { User } from "../../domain/auth/User";
import { Logger } from "../../utils/Logger";

/**
 * Express.js authentication adapter
 * Bridges between Express/Passport and the authentication service
 */
export class ExpressAuthenticationAdapter {
  constructor(private readonly authenticationService: AuthenticationPort) {}

  /**
   * Handle Google OAuth callback
   * Converts Express request to domain objects and delegates to authentication service
   */
  async handleGoogleCallback(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      Logger.debug("[EXPRESS_AUTH] Google OAuth callback received", { 
        profileId: profile.id,
        displayName: profile.displayName 
      });

      // Convert Passport profile to domain GoogleProfile
      const googleProfile: GoogleProfile = {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails || [],
        photos: profile.photos || []
      };

      // Delegate to authentication service
      const user = await this.authenticationService.authenticateWithGoogle(googleProfile);
      
      Logger.debug("[EXPRESS_AUTH] Authentication successful", { 
        userId: user.id.value,
        googleId: user.googleId 
      });

      // Convert domain User back to Passport user format
      const passportUser = this.convertUserToPassportFormat(user);
      done(null, passportUser);

    } catch (error) {
      Logger.error("[EXPRESS_AUTH] Authentication failed", error as Error);
      done(error, false);
    }
  }

  /**
   * Serialize user for session storage
   */
  async serializeUser(user: any, done: (error: any, id?: any) => void): Promise<void> {
    try {
      // Convert Passport user back to domain User if needed
      const domainUser = this.convertPassportUserToDomain(user);
      const serializedId = await this.authenticationService.serializeUser(domainUser);
      
      Logger.debug("[EXPRESS_AUTH] User serialized", { userId: serializedId });
      done(null, serializedId);

    } catch (error) {
      Logger.error("[EXPRESS_AUTH] User serialization failed", error as Error);
      done(error, null);
    }
  }

  /**
   * Deserialize user from session storage
   */
  async deserializeUser(id: string, done: (error: any, user?: any) => void): Promise<void> {
    try {
      const user = await this.authenticationService.deserializeUser(id);
      
      if (user) {
        Logger.debug("[EXPRESS_AUTH] User deserialized", { userId: user.id.value });
        const passportUser = this.convertUserToPassportFormat(user);
        done(null, passportUser);
      } else {
        Logger.debug("[EXPRESS_AUTH] User not found during deserialization", { userId: id });
        done(null, false);
      }

    } catch (error) {
      Logger.error("[EXPRESS_AUTH] User deserialization failed", error as Error);
      done(error, false);
    }
  }

  /**
   * Convert domain User to Passport user format
   * Maintains compatibility with existing Express session handling
   */
  private convertUserToPassportFormat(user: User): any {
    return {
      id: parseInt(user.id.value), // Convert to number for compatibility
      google_id: user.googleId,
      display_name: user.displayName,
      email: user.email || null,
      picture: user.picture || null
    };
  }

  /**
   * Convert Passport user format back to domain User
   * Handles the conversion for serialization
   */
  private convertPassportUserToDomain(passportUser: any): User {
    return User.fromPlainObject({
      id: passportUser.id.toString(),
      googleId: passportUser.google_id,
      displayName: passportUser.display_name,
      email: passportUser.email || undefined,
      picture: passportUser.picture || undefined
    });
  }

  /**
   * Middleware to ensure user is authenticated
   */
  requireAuth(req: Request, res: Response, next: NextFunction): void {
    if (req.isAuthenticated()) {
      Logger.debug("[EXPRESS_AUTH] User authenticated", { 
        userId: req.user ? (req.user as any).id : 'unknown' 
      });
      next();
    } else {
      Logger.warn("[EXPRESS_AUTH] Unauthenticated access attempt");
      res.status(401).json({ error: "認証が必要です" });
    }
  }

  /**
   * Middleware to get current user (optional authentication)
   */
  getCurrentUser(req: Request, res: Response, next: NextFunction): void {
    if (req.isAuthenticated()) {
      Logger.debug("[EXPRESS_AUTH] Current user available", { 
        userId: req.user ? (req.user as any).id : 'unknown' 
      });
    } else {
      Logger.debug("[EXPRESS_AUTH] No current user (anonymous access)");
    }
    next();
  }
}