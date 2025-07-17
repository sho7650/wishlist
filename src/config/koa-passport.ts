// src/config/koa-passport.ts
import koaPassport from "koa-passport";
import { DatabaseConnection } from "../infrastructure/db/DatabaseConnection";
import { BasePassportConfig } from "./BasePassportConfig";

export function configureKoaPassport(db: DatabaseConnection) {
  const baseConfig = new BasePassportConfig(db);

  // Use common serialization logic
  koaPassport.serializeUser((user: any, done) => { // External library callback - any is acceptable here
    baseConfig.serializeUser(user, done);
  });

  // Use common deserialization logic
  koaPassport.deserializeUser(async (id: number, done) => {
    await baseConfig.deserializeUser(id, done);
  });

  // Use common Google Strategy
  koaPassport.use(baseConfig.createGoogleStrategy());
}

export { koaPassport };
