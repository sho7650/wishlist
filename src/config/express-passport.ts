// src/config/passport.ts
import { PassportStatic } from "passport";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { DatabaseConnection } from "../infrastructure/db/DatabaseConnection";

// ユーザー情報の型定義
interface User {
  id: number;
  google_id: string;
  display_name: string;
  email?: string;
}

export function configureExpressPassport(db: DatabaseConnection) {
  // SQLite compatibility: detect parameter syntax
  const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
  const param1 = isSQLite ? '?' : '$1';
  const param2 = isSQLite ? '?' : '$2';
  const param3 = isSQLite ? '?' : '$3';
  const param4 = isSQLite ? '?' : '$4';
  passport.serializeUser((user: any, done) => {
    if (!user || typeof user.id === "undefined") {
      return done(new Error("Invalid user object for serialization."), null);
    }
    done(null, user.id);
  });

  // --- 👇 deserializeUser の修正 ---
  // セッションからユーザー情報を復元する方法を定義
  passport.deserializeUser(async (id: number, done) => {
    try {
      const result = await db.query(`SELECT * FROM users WHERE id = ${param1}`, [id]);
      const user = result.rows[0];

      if (user) {
        // ユーザーが見つかった場合
        // 第1引数に null, 第2引数にユーザーオブジェクトを渡す
        done(null, user);
      } else {
        // ユーザーが見つからなかった場合
        // エラーではないが、ユーザーはいないので false を渡す
        done(null, false);
      }
    } catch (err) {
      // DBエラーなどが発生した場合
      // 第1引数にエラーオブジェクトを渡す
      done(err, false);
    }
  });

  // --- 👇 GoogleStrategy の done の呼び出し方も確認・修正 ---
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const pictureUrl =
            profile.photos && profile.photos.length > 0
              ? profile.photos[0].value
              : null;
          // 1. GoogleプロファイルIDで既存ユーザーを探す
          const currentUserResult = await db.query(
            `SELECT * FROM users WHERE google_id = ${param1}`,
            [profile.id]
          );

          if (currentUserResult.rows.length > 0) {
            // 2. ユーザーが存在する場合
            const existingUser = currentUserResult.rows[0];
            if (isSQLite) {
              // SQLite doesn't support RETURNING, so update and then select
              const updateUserQuery =
                `UPDATE users SET display_name = ${param1}, picture = ${param2} WHERE google_id = ${param3}`;
              await db.query(updateUserQuery, [
                profile.displayName,
                pictureUrl,
                profile.id,
              ]);
              // Get the updated user
              const updatedUserResult = await db.query(
                `SELECT * FROM users WHERE google_id = ${param1}`,
                [profile.id]
              );
              done(null, updatedUserResult.rows[0]);
            } else {
              // PostgreSQL/MySQL with RETURNING support
              const updateUserQuery =
                `UPDATE users SET display_name = ${param1}, picture = ${param2} WHERE google_id = ${param3} RETURNING *`;
              const updatedUserResult = await db.query(updateUserQuery, [
                profile.displayName,
                pictureUrl,
                profile.id,
              ]);
              done(null, updatedUserResult.rows[0]);
            }
          } else {
            // 3. ユーザーが存在しない場合、新しく作成する
            if (isSQLite) {
              // SQLite doesn't support RETURNING, so insert and then select
              const newUserQuery =
                `INSERT INTO users (google_id, display_name, email, picture) VALUES (${param1}, ${param2}, ${param3}, ${param4})`;
              await db.query(newUserQuery, [
                profile.id,
                profile.displayName,
                profile.emails ? profile.emails[0].value : null,
                pictureUrl,
              ]);
              // Get the newly created user
              const newUserResult = await db.query(
                `SELECT * FROM users WHERE google_id = ${param1}`,
                [profile.id]
              );
              done(null, newUserResult.rows[0]);
            } else {
              // PostgreSQL/MySQL with RETURNING support
              const newUserQuery =
                `INSERT INTO users (google_id, display_name, email, picture) VALUES (${param1}, ${param2}, ${param3}, ${param4}) RETURNING *`;
              const newUserResult = await db.query(newUserQuery, [
                profile.id,
                profile.displayName,
                profile.emails ? profile.emails[0].value : null,
                pictureUrl,
              ]);
              done(null, newUserResult.rows[0]);
            }
          }
        } catch (err) {
          done(err, false);
        }
      }
    )
  );
}
export { passport };
