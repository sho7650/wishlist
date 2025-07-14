import { Context, Next } from "koa";
import { AuthenticationPort } from "../../ports/AuthenticationPort";
import { GoogleProfile } from "../../domain/auth/GoogleProfile";
import { User } from "../../domain/auth/User";
import { Logger } from "../../utils/Logger";

/**
 * Koa.js authentication adapter
 * Bridges between Koa/Passport and the authentication service
 */
export class KoaAuthenticationAdapter {
  constructor(private readonly authenticationService: AuthenticationPort) {}

  /**
   * Handle Google OAuth callback
   * Converts Koa request to domain objects and delegates to authentication service
   */
  async handleGoogleCallback(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      Logger.debug("[KOA_AUTH] Google OAuth callback received", { 
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
      
      Logger.debug("[KOA_AUTH] Authentication successful", { 
        userId: user.id.value,
        googleId: user.googleId 
      });

      // Convert domain User back to Passport user format
      const passportUser = this.convertUserToPassportFormat(user);
      done(null, passportUser);

    } catch (error) {
      Logger.error("[KOA_AUTH] Authentication failed", error as Error);
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
      
      Logger.debug("[KOA_AUTH] User serialized", { userId: serializedId });
      done(null, serializedId);

    } catch (error) {
      Logger.error("[KOA_AUTH] User serialization failed", error as Error);
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
        Logger.debug("[KOA_AUTH] User deserialized", { userId: user.id.value });
        const passportUser = this.convertUserToPassportFormat(user);
        done(null, passportUser);
      } else {
        Logger.debug("[KOA_AUTH] User not found during deserialization", { userId: id });
        done(null, false);
      }

    } catch (error) {
      Logger.error("[KOA_AUTH] User deserialization failed", error as Error);
      done(error, false);
    }
  }

  /**
   * Convert domain User to Passport user format
   * Maintains compatibility with existing Koa session handling
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
  requireAuth(ctx: Context, next: Next): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ctx.isAuthenticated()) {
        Logger.debug("[KOA_AUTH] User authenticated", { 
          userId: ctx.state.user ? ctx.state.user.id : 'unknown' 
        });
        resolve(next());
      } else {
        Logger.warn("[KOA_AUTH] Unauthenticated access attempt");
        ctx.status = 401;
        ctx.body = { error: "認証が必要です" };
        resolve();
      }
    });
  }

  /**
   * Middleware to get current user (optional authentication)
   */
  getCurrentUser(ctx: Context, next: Next): Promise<void> {
    return new Promise((resolve) => {
      if (ctx.isAuthenticated()) {
        Logger.debug("[KOA_AUTH] Current user available", { 
          userId: ctx.state.user ? ctx.state.user.id : 'unknown' 
        });
      } else {
        Logger.debug("[KOA_AUTH] No current user (anonymous access)");
      }
      resolve(next());
    });
  }
}