// src/config/passport-koa.ts

import koaPassport from "koa-passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { DatabaseConnection } from "../infrastructure/db/DatabaseConnection";

interface User {
  id: number;
  google_id: string;
  display_name: string;
  email?: string;
}

export function configureKoaPassport(db: DatabaseConnection) {
  // SQLite compatibility: detect parameter syntax
  const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
  const param1 = isSQLite ? '?' : '$1';
  const param2 = isSQLite ? '?' : '$2';
  const param3 = isSQLite ? '?' : '$3';
  const param4 = isSQLite ? '?' : '$4';
  koaPassport.serializeUser((user: any, done) => {
    if (!user || typeof user.id === "undefined") {
      return done(new Error("Invalid user object for serialization."), null);
    }
    done(null, user.id);
  });

  koaPassport.deserializeUser(async (id: number, done) => {
    try {
      const result = await db.query(`SELECT * FROM users WHERE id = ${param1}`, [id]);
      const user = result.rows[0];
      done(null, user || false);
    } catch (error) {
      done(error, false);
    }
  });

  koaPassport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        console.log("--- Google Strategy Callback ---");
        console.log("Profile received:", profile);
        console.log("Type of profile object:", typeof profile);
        try {
          const pictureUrl =
            profile.photos && profile.photos.length > 0
              ? profile.photos[0].value
              : null;
          const existingUserResult = await db.query(
            `SELECT * FROM users WHERE google_id = ${param1}`,
            [profile.id]
          );

          if (existingUserResult.rows.length > 0) {
            console.log("User already exists:", existingUserResult.rows[0]);
            const existingUser = existingUserResult.rows[0];
            const updateUserQuery =
              `UPDATE users SET display_name = ${param1}, picture = ${param2} WHERE google_id = ${param3} RETURNING *`;
            const updatedUserResult = await db.query(updateUserQuery, [
              profile.displayName,
              pictureUrl,
              profile.id,
            ]);
            return done(null, updatedUserResult.rows[0]);
          }

          const newUserQuery =
            `INSERT INTO users (google_id, display_name, email, picture) VALUES (${param1}, ${param2}, ${param3}, ${param4}) RETURNING *`;

          const newUserResult = await db.query(newUserQuery, [
            profile.id,
            profile.displayName,
            profile.emails ? profile.emails[0].value : null,
            pictureUrl,
          ]);

          return done(null, newUserResult.rows[0]);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

export { koaPassport };
