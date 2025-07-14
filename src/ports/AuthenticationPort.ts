import { User } from "../domain/auth/User";
import { GoogleProfile } from "../domain/auth/GoogleProfile";

/**
 * Authentication port interface
 * Defines the contract for authentication operations
 */
export interface AuthenticationPort {
  /**
   * Authenticate a user with Google OAuth profile
   * @param profile Google OAuth profile data
   * @returns Authenticated user
   */
  authenticateWithGoogle(profile: GoogleProfile): Promise<User>;

  /**
   * Serialize user for session storage
   * @param user User to serialize
   * @returns Serialized user identifier
   */
  serializeUser(user: User): Promise<string>;

  /**
   * Deserialize user from session storage
   * @param serializedUser Serialized user identifier
   * @returns User if found, null otherwise
   */
  deserializeUser(serializedUser: string): Promise<User | null>;
}

/**
 * Authentication result for tracking auth state
 */
export interface AuthenticationResult {
  user: User;
  isNewUser: boolean;
  sessionId?: string;
}

/**
 * Authentication error types
 */
export enum AuthenticationError {
  INVALID_PROFILE = "INVALID_PROFILE",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  SERIALIZATION_ERROR = "SERIALIZATION_ERROR",
  REPOSITORY_ERROR = "REPOSITORY_ERROR"
}

/**
 * Custom authentication exception
 */
export class AuthenticationException extends Error {
  constructor(
    public readonly errorType: AuthenticationError,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "AuthenticationException";
  }
}