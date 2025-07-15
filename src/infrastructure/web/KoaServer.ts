// src/infrastructure/web/KoaServer.ts

import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import helmet from "koa-helmet";
import path from "path";
import fs from "fs";
import { WebServer } from "./WebServer";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import session from "koa-session";
import koaPassport from "koa-passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { KoaAuthenticationAdapter } from "../../adapters/primary/KoaAuthenticationAdapter";
import { configureKoaPassport } from "../../config/koa-passport";
import { Logger } from "../../utils/Logger";

export class KoaServer implements WebServer {
  private app: Koa;
  private router: Router;

  constructor(
    private dbConnection: any,
    private koaWishAdapter: KoaWishAdapter,
    private authenticationAdapter?: KoaAuthenticationAdapter
  ) {
    this.app = new Koa();
    this.router = new Router();

    this.app.keys = [process.env.SESSION_SECRET || "default_dev_secret"];

    // Configure Passport with authentication adapter if available
    if (this.authenticationAdapter) {
      this.configurePassportWithAdapter();
    } else {
      // Fall back to legacy configuration
      configureKoaPassport(this.dbConnection);
    }

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(
      helmet.contentSecurityPolicy({
        directives: {
          // デフォルトのソースを 'self' に設定
          defaultSrc: ["'self'"],
          // スクリプトのソース：自分自身と、もしインラインスクリプトがあれば 'unsafe-inline'
          scriptSrc: ["'self'"],
          // スタイルのソース：自分自身と、Google Fonts、インラインスタイル
          styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
          // ★★★ 画像のソース ★★★
          // 自分自身、data:スキーム、そしてGoogleの画像ドメインを許可
          imgSrc: ["'self'", "data:", "lh3.googleusercontent.com"],
          // 接続元
          connectSrc: ["'self'"],
          // フォントのソース
          fontSrc: ["'self'", "fonts.gstatic.com"],
          // オブジェクトのソース
          objectSrc: ["'none'"],
          // メディアのソース
          mediaSrc: ["'self'"],
          // フレームのソース
          frameSrc: ["'none'"],
          // CSP違反のレポート先(任意)
          // reportUri: '/csp-violation-report-endpoint',
        },
      })
    );

    // Koaのセッション管理
    this.app.use(session({}, this.app));

    // koa-passport による認証
    this.app.use(koaPassport.initialize());
    this.app.use(koaPassport.session());

    this.app.use(bodyParser());
    this.app.use(serve(path.join(__dirname, "../../../public")));
  }

  private setupRoutes(): void {
    const ensureAuth: Koa.Middleware = async (ctx, next) => {
      if (ctx.isAuthenticated()) {
        await next();
      } else {
        ctx.status = 401;
        ctx.body = { error: "Unauthorized" };
      }
    };

    // 認証ルート
    this.router.get(
      "/auth/google",
      koaPassport.authenticate("google", { scope: ["profile", "email"] })
    );

    this.router.get(
      "/auth/google/callback",
      koaPassport.authenticate("google", {
        successRedirect: "/",
        failureRedirect: "/",
      })
    );

    this.router.get("/auth/logout", async (ctx) => {
      ctx.logout();
      ctx.redirect("/");
    });

    this.router.get("/api/user", (ctx) => {
      ctx.body = ctx.state.user || null;
    });

    // 既存のルートに認証チェックを適用
    this.router.post("/api/wishes", ensureAuth, this.koaWishAdapter.createWish);
    this.router.put("/api/wishes", ensureAuth, this.koaWishAdapter.updateWish);
    this.router.get("/api/wishes/current", this.koaWishAdapter.getCurrentWish);
    this.router.get("/api/wishes", this.koaWishAdapter.getLatestWishes);
    this.router.get("/api/user/wish", this.koaWishAdapter.getUserWish);
    
    // 応援機能のルート
    this.router.post("/api/wishes/:wishId/support", this.koaWishAdapter.supportWish);
    this.router.delete("/api/wishes/:wishId/support", this.koaWishAdapter.unsupportWish);
    this.router.get("/api/wishes/:wishId/support", this.koaWishAdapter.getWishSupportStatus);

    this.app.use(this.router.routes()).use(this.router.allowedMethods());

    // SPAフォールバック
    this.app.use(async (ctx) => {
      if (ctx.status === 404 && !ctx.path.startsWith("/api/")) {
        ctx.type = "html";
        ctx.body = fs.createReadStream(
          path.join(__dirname, "../../../public/index.html")
        );
      }
    });
  }

  /**
   * Configure Passport with authentication adapter
   */
  private configurePassportWithAdapter(): void {
    if (!this.authenticationAdapter) return;

    // Configure Passport serialization using the adapter
    koaPassport.serializeUser((user: any, done) => {
      this.authenticationAdapter!.serializeUser(user, done);
    });

    koaPassport.deserializeUser((id: string, done) => {
      this.authenticationAdapter!.deserializeUser(id, done);
    });

    // Configure Google Strategy using the adapter
    koaPassport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        },
        (accessToken, refreshToken, profile, done) => {
          this.authenticationAdapter!.handleGoogleCallback(accessToken, refreshToken, profile, done);
        }
      )
    );
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      Logger.info(`[KOA] Server running on port ${port}`);
    });
  }
}
