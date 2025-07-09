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
  koaPassport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  koaPassport.deserializeUser(async (id: number, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
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
        try {
          const existingUserResult = await db.query(
            "SELECT * FROM users WHERE google_id = $1",
            [profile.id]
          );

          if (existingUserResult.rows.length > 0) {
            return done(null, existingUserResult.rows[0]);
          }

          const newUserQuery =
            "INSERT INTO users (google_id, display_name, email) VALUES ($1, $2, $3) RETURNING *";

          console.log("Executing SQL:", newUserQuery);
          console.log(
            "With values:",
            profile.id,
            profile.displayName,
            profile.emails ? profile.emails[0].value : null
          );
          const newUserResult = await db.query(newUserQuery, [
            profile.id,
            profile.displayName,
            profile.emails ? profile.emails[0].value : null,
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
