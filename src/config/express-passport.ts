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
      const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
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
            "SELECT * FROM users WHERE google_id = $1",
            [profile.id]
          );

          if (currentUserResult.rows.length > 0) {
            // 2. ユーザーが存在する場合
            const existingUser = currentUserResult.rows[0];
            const updateUserQuery =
              "UPDATE users SET display_name = $1, picture = $2 WHERE google_id = $3 RETURNING *";
            const updatedUserResult = await db.query(updateUserQuery, [
              profile.displayName,
              pictureUrl,
              profile.id,
            ]);
            done(null, currentUserResult.rows[0]);
          } else {
            // 3. ユーザーが存在しない場合、新しく作成する
            const newUserQuery =
              "INSERT INTO users (google_id, display_name, email, picture) VALUES ($1, $2, $3, $4) RETURNING *";
            const newUserResult = await db.query(newUserQuery, [
              profile.id,
              profile.displayName,
              profile.emails ? profile.emails[0].value : null,
              pictureUrl,
            ]);
            done(null, newUserResult.rows[0]);
          }
        } catch (err) {
          done(err, false);
        }
      }
    )
  );
}
export { passport };
