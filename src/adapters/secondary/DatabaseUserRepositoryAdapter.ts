import { UserRepositoryPort, UserRepositoryError, UserRepositoryException } from "../../ports/UserRepositoryPort";
import { User } from "../../domain/auth/User";
import { UserId } from "../../domain/auth/UserId";
import { QueryExecutor } from "../../infrastructure/db/query/QueryExecutor";

/**
 * Database implementation of UserRepositoryPort
 * Handles user persistence operations using QueryExecutor abstraction
 */
export class DatabaseUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly queryExecutor: QueryExecutor) {}

  async findByGoogleId(googleId: string): Promise<User | null> {
    try {
      const result = await this.queryExecutor.select("users", {
        where: { google_id: googleId }
      });

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        `Failed to find user by Google ID: ${googleId}`,
        error as Error
      );
    }
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      const result = await this.queryExecutor.select("users", {
        where: { id: id.value }
      });

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        `Failed to find user by ID: ${id.value}`,
        error as Error
      );
    }
  }

  async save(user: User): Promise<User> {
    if (!user.isNewUser()) {
      throw new UserRepositoryException(
        UserRepositoryError.INVALID_USER_DATA,
        "Cannot save existing user, use update instead"
      );
    }

    try {
      const userData = this.mapUserToData(user);
      const result = await this.queryExecutor.insert("users", userData);

      if (result.rows.length > 0) {
        // Database returned the inserted row (PostgreSQL/MySQL with RETURNING)
        return this.mapRowToUser(result.rows[0]);
      } else {
        // SQLite case - need to fetch the inserted user
        return await this.findByGoogleId(user.googleId) as User;
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      if (errorMessage.includes("UNIQUE") || errorMessage.includes("duplicate")) {
        throw new UserRepositoryException(
          UserRepositoryError.DUPLICATE_GOOGLE_ID,
          `User with Google ID ${user.googleId} already exists`,
          error as Error
        );
      }

      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Failed to save user",
        error as Error
      );
    }
  }

  async update(user: User): Promise<User> {
    if (user.isNewUser()) {
      throw new UserRepositoryException(
        UserRepositoryError.INVALID_USER_DATA,
        "Cannot update new user, use save instead"
      );
    }

    try {
      const updateData = {
        display_name: user.displayName,
        email: user.email ?? null,
        picture: user.picture ?? null
      };

      const result = await this.queryExecutor.update(
        "users",
        updateData,
        { id: user.id.value }
      );

      if ((result.rowCount ?? 0) === 0) {
        throw new UserRepositoryException(
          UserRepositoryError.USER_NOT_FOUND,
          `User with ID ${user.id.value} not found for update`
        );
      }

      // Return updated user (fetch from database to ensure consistency)
      return await this.findById(user.id) as User;
    } catch (error) {
      if (error instanceof UserRepositoryException) {
        throw error;
      }

      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Failed to update user",
        error as Error
      );
    }
  }

  async delete(id: UserId): Promise<boolean> {
    try {
      const result = await this.queryExecutor.delete("users", {
        id: id.value
      });

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        `Failed to delete user with ID: ${id.value}`,
        error as Error
      );
    }
  }

  async existsByGoogleId(googleId: string): Promise<boolean> {
    try {
      const result = await this.queryExecutor.raw(
        "SELECT COUNT(*) as count FROM users WHERE google_id = ?",
        [googleId]
      );

      return (result.rows[0]?.count ?? 0) > 0;
    } catch (error) {
      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        `Failed to check existence by Google ID: ${googleId}`,
        error as Error
      );
    }
  }

  async count(): Promise<number> {
    try {
      const result = await this.queryExecutor.raw(
        "SELECT COUNT(*) as count FROM users",
        []
      );

      return result.rows[0]?.count ?? 0;
    } catch (error) {
      throw new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Failed to count users",
        error as Error
      );
    }
  }

  /**
   * Map database row to User domain entity
   */
  private mapRowToUser(row: any): User {
    return User.fromPlainObject({
      id: row.id.toString(),
      googleId: row.google_id,
      displayName: row.display_name,
      email: row.email || undefined,
      picture: row.picture || undefined
    });
  }

  /**
   * Map User domain entity to database data
   */
  private mapUserToData(user: User): Record<string, any> {
    return {
      google_id: user.googleId,
      display_name: user.displayName,
      email: user.email ?? null,
      picture: user.picture ?? null
    };
  }
}