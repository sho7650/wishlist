import { User } from "../domain/auth/User";
import { UserId } from "../domain/auth/UserId";

/**
 * User repository port interface
 * Defines the contract for user persistence operations
 */
export interface UserRepositoryPort {
  /**
   * Find user by Google ID
   * @param googleId Google OAuth ID
   * @returns User if found, null otherwise
   */
  findByGoogleId(googleId: string): Promise<User | null>;

  /**
   * Find user by internal user ID
   * @param id User ID
   * @returns User if found, null otherwise
   */
  findById(id: UserId): Promise<User | null>;

  /**
   * Save a new user
   * @param user New user to save
   * @returns Saved user with persistent ID
   */
  save(user: User): Promise<User>;

  /**
   * Update an existing user
   * @param user User to update
   * @returns Updated user
   */
  update(user: User): Promise<User>;

  /**
   * Delete a user
   * @param id User ID to delete
   * @returns True if deleted, false if not found
   */
  delete(id: UserId): Promise<boolean>;

  /**
   * Check if a user exists by Google ID
   * @param googleId Google OAuth ID
   * @returns True if exists, false otherwise
   */
  existsByGoogleId(googleId: string): Promise<boolean>;

  /**
   * Get total count of users
   * @returns Total number of users
   */
  count(): Promise<number>;
}

/**
 * User repository error types
 */
export enum UserRepositoryError {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  DUPLICATE_GOOGLE_ID = "DUPLICATE_GOOGLE_ID",
  INVALID_USER_DATA = "INVALID_USER_DATA",
  DATABASE_ERROR = "DATABASE_ERROR"
}

/**
 * Custom user repository exception
 */
export class UserRepositoryException extends Error {
  constructor(
    public readonly errorType: UserRepositoryError,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "UserRepositoryException";
  }
}