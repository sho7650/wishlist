// src/infrastructure/web/MiddlewareConfigurationFactory.ts

export class MiddlewareConfigurationFactory {
  /**
   * Creates unified session configuration
   * Eliminates duplication between Express and Koa servers
   */
  static createSessionConfiguration(): any {
    return {
      secret: process.env.SESSION_SECRET || "default_dev_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24時間
    };
  }

  /**
   * Creates unified session keys for Koa
   */
  static createSessionKeys(): string[] {
    return [process.env.SESSION_SECRET || "default_dev_secret"];
  }

  /**
   * Creates unified Google OAuth configuration
   */
  static createGoogleOAuthConfiguration(): any {
    return {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
    };
  }

  /**
   * Creates unified Google OAuth scope configuration
   */
  static createGoogleOAuthScope(): string[] {
    return ["profile", "email"];
  }

  /**
   * Creates unified OAuth redirect configuration
   */
  static createOAuthRedirectConfiguration(): any {
    return {
      successRedirect: "/",
      failureRedirect: "/",
    };
  }
}