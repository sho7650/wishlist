// src/config/express-passport.ts
import passport from "passport";
import { DatabaseConnection } from "../infrastructure/db/DatabaseConnection";
import { BasePassportConfig } from "./BasePassportConfig";

export function configureExpressPassport(db: DatabaseConnection) {
  const baseConfig = new BasePassportConfig(db);

  // Use common serialization logic
  passport.serializeUser((user: any, done) => {
    baseConfig.serializeUser(user, done);
  });

  // Use common deserialization logic
  passport.deserializeUser(async (id: number, done) => {
    await baseConfig.deserializeUser(id, done);
  });

  // Use common Google Strategy
  passport.use(baseConfig.createGoogleStrategy());
}
export { passport };
