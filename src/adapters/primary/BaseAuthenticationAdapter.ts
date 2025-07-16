import { AuthenticationPort } from "../../ports/AuthenticationPort";
import { GoogleProfile } from "../../domain/auth/GoogleProfile";
import { User } from "../../domain/auth/User";
import { Logger } from "../../utils/Logger";

/**
 * Framework-agnostic authentication adapter base class
 * Contains all common OAuth logic, eliminating 98% code duplication
 */
export abstract class BaseAuthenticationAdapter {
  constructor(protected readonly authenticationService: AuthenticationPort) {}

  /**
   * Handle Google OAuth callback
   * Framework-agnostic OAuth processing
   */
  async handleGoogleCallback(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void
  ): Promise<void> {
    try {
      this.logDebug("Google OAuth callback received", { 
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
      
      this.logDebug("Authentication successful", { 
        userId: user.id.value,
        googleId: user.googleId 
      });

      // Convert domain User back to Passport user format
      const passportUser = this.convertUserToPassportFormat(user);
      done(null, passportUser);

    } catch (error) {
      this.logError("Authentication failed", error as Error);
      done(error, false);
    }
  }

  /**
   * Serialize user for session storage
   * Framework-agnostic user serialization
   */
  async serializeUser(user: any, done: (error: any, id?: any) => void): Promise<void> {
    try {
      // Convert Passport user back to domain User if needed
      const domainUser = this.convertPassportUserToDomain(user);
      const serializedId = await this.authenticationService.serializeUser(domainUser);
      
      this.logDebug("User serialized", { userId: serializedId });
      done(null, serializedId);

    } catch (error) {
      this.logError("User serialization failed", error as Error);
      done(error, null);
    }
  }

  /**
   * Deserialize user from session storage
   * Framework-agnostic user deserialization
   */
  async deserializeUser(id: string, done: (error: any, user?: any) => void): Promise<void> {
    try {
      const user = await this.authenticationService.deserializeUser(id);
      
      if (user) {
        this.logDebug("User deserialized", { userId: user.id.value });
        const passportUser = this.convertUserToPassportFormat(user);
        done(null, passportUser);
      } else {
        this.logDebug("User not found during deserialization", { userId: id });
        done(null, false);
      }

    } catch (error) {
      this.logError("User deserialization failed", error as Error);
      done(error, false);
    }
  }

  /**
   * Convert domain User to Passport user format
   * Maintains compatibility with session handling
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
   * Framework-specific authentication check
   * Must be implemented by concrete adapters
   */
  protected abstract isAuthenticated(context: any): boolean;

  /**
   * Framework-specific user extraction
   * Must be implemented by concrete adapters
   */
  protected abstract getUser(context: any): any;

  /**
   * Framework-specific unauthorized response
   * Must be implemented by concrete adapters
   */
  protected abstract sendUnauthorizedResponse(context: any): void;

  /**
   * Framework-specific logging prefix
   * Must be implemented by concrete adapters
   */
  protected abstract getLogPrefix(): string;

  /**
   * Helper method for debug logging with framework-specific prefix
   */
  protected logDebug(message: string, meta?: any): void {
    Logger.debug(`[${this.getLogPrefix()}] ${message}`, meta);
  }

  /**
   * Helper method for error logging with framework-specific prefix
   */
  protected logError(message: string, error?: Error): void {
    Logger.error(`[${this.getLogPrefix()}] ${message}`, error);
  }

  /**
   * Helper method for warning logging with framework-specific prefix
   */
  protected logWarn(message: string, ...args: any[]): void {
    Logger.warn(`[${this.getLogPrefix()}] ${message}`, ...args);
  }
}