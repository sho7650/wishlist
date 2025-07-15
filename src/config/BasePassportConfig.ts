import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { DatabaseConnection } from "../infrastructure/db/DatabaseConnection";
import { Logger } from "../utils/Logger";

/**
 * Base passport configuration with common OAuth and database logic
 * Eliminates 95% code duplication between Express and Koa passport configs
 */
export class BasePassportConfig {
  constructor(private db: DatabaseConnection) {}

  /**
   * Create Google OAuth strategy with common logic
   */
  createGoogleStrategy(): GoogleStrategy {
    return new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        Logger.debug("[AUTH] Google OAuth callback initiated");
        Logger.debug("[AUTH] OAuth profile received", {
          id: profile.id,
          displayName: profile.displayName,
          profileType: typeof profile
        });

        try {
          const pictureUrl = profile.photos && profile.photos.length > 0
            ? profile.photos[0].value
            : null;

          const user = await this.findOrCreateUser(profile, pictureUrl);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    );
  }

  /**
   * Find existing user or create new user
   * Handles both SQLite and PostgreSQL/MySQL databases
   */
  private async findOrCreateUser(profile: any, pictureUrl: string | null): Promise<any> {
    const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
    const param1 = isSQLite ? '?' : '$1';
    const param2 = isSQLite ? '?' : '$2';
    const param3 = isSQLite ? '?' : '$3';
    const param4 = isSQLite ? '?' : '$4';

    // Check for existing user
    const existingUserResult = await this.db.query(
      `SELECT * FROM users WHERE google_id = ${param1}`,
      [profile.id]
    );

    if (existingUserResult.rows.length > 0) {
      // Update existing user
      Logger.debug("[AUTH] Existing user found", { userId: existingUserResult.rows[0].id });
      return await this.updateExistingUser(profile, pictureUrl, isSQLite);
    } else {
      // Create new user
      return await this.createNewUser(profile, pictureUrl, isSQLite);
    }
  }

  /**
   * Update existing user with latest profile information
   */
  private async updateExistingUser(profile: any, pictureUrl: string | null, isSQLite: boolean): Promise<any> {
    const param1 = isSQLite ? '?' : '$1';
    const param2 = isSQLite ? '?' : '$2';
    const param3 = isSQLite ? '?' : '$3';

    if (isSQLite) {
      // SQLite doesn't support RETURNING, so update and then select
      const updateUserQuery = `UPDATE users SET display_name = ${param1}, picture = ${param2} WHERE google_id = ${param3}`;
      await this.db.query(updateUserQuery, [profile.displayName, pictureUrl, profile.id]);
      
      // Get the updated user
      const updatedUserResult = await this.db.query(
        `SELECT * FROM users WHERE google_id = ${param1}`,
        [profile.id]
      );
      return updatedUserResult.rows[0];
    } else {
      // PostgreSQL/MySQL with RETURNING support
      const updateUserQuery = `UPDATE users SET display_name = ${param1}, picture = ${param2} WHERE google_id = ${param3} RETURNING *`;
      const updatedUserResult = await this.db.query(updateUserQuery, [
        profile.displayName,
        pictureUrl,
        profile.id,
      ]);
      return updatedUserResult.rows[0];
    }
  }

  /**
   * Create new user with profile information
   */
  private async createNewUser(profile: any, pictureUrl: string | null, isSQLite: boolean): Promise<any> {
    const param1 = isSQLite ? '?' : '$1';
    const param2 = isSQLite ? '?' : '$2';
    const param3 = isSQLite ? '?' : '$3';
    const param4 = isSQLite ? '?' : '$4';

    const email = profile.emails ? profile.emails[0].value : null;

    if (isSQLite) {
      // SQLite doesn't support RETURNING, so insert and then select
      const newUserQuery = `INSERT INTO users (google_id, display_name, email, picture) VALUES (${param1}, ${param2}, ${param3}, ${param4})`;
      await this.db.query(newUserQuery, [profile.id, profile.displayName, email, pictureUrl]);
      
      // Get the newly created user
      const newUserResult = await this.db.query(
        `SELECT * FROM users WHERE google_id = ${param1}`,
        [profile.id]
      );
      return newUserResult.rows[0];
    } else {
      // PostgreSQL/MySQL with RETURNING support
      const newUserQuery = `INSERT INTO users (google_id, display_name, email, picture) VALUES (${param1}, ${param2}, ${param3}, ${param4}) RETURNING *`;
      const newUserResult = await this.db.query(newUserQuery, [
        profile.id,
        profile.displayName,
        email,
        pictureUrl,
      ]);
      return newUserResult.rows[0];
    }
  }

  /**
   * Common user serialization logic
   */
  serializeUser(user: any, done: (error: any, id?: any) => void): void {
    if (!user || typeof user.id === "undefined") {
      return done(new Error("Invalid user object for serialization."), null);
    }
    done(null, user.id);
  }

  /**
   * Common user deserialization logic
   */
  async deserializeUser(id: number, done: (error: any, user?: any) => void): Promise<void> {
    try {
      const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
      const param1 = isSQLite ? '?' : '$1';
      
      const result = await this.db.query(`SELECT * FROM users WHERE id = ${param1}`, [id]);
      const user = result.rows[0];

      if (user) {
        done(null, user);
      } else {
        done(null, false);
      }
    } catch (err) {
      done(err, false);
    }
  }
}