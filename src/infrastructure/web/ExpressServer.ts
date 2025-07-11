// src/infrastructure/web/ExpressServer.ts
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import { WishController } from "../../adapters/primary/WishController";
import { WebServer } from "./WebServer";
import session from "express-session";
// import passport from "passport";
import {
  configureExpressPassport,
  passport,
} from "../../config/express-passport";

export class ExpressServer implements WebServer {
  private app = express();

  constructor(dbConnection: any, private wishController: WishController) {
    this.setupMiddleware();
    this.setupRoutes();

    configureExpressPassport(dbConnection); // Passportの設定を追加
  }

  private setupMiddleware(): void {
    // ★★★ セッションとPassportのミドルウェアを追加 ★★★
    // 必ず helmet の後、かつルート設定の前に追加します
    this.app.use(
      session({
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24時間
      })
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
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
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../../../public")));
    this.app.use(cookieParser());
  }

  private setupRoutes(): void {
    // --- ★ 認証用のルートを新規追加 ★ ---
    this.app.get(
      "/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"], // Googleから取得したい情報
      })
    );

    this.app.get(
      "/auth/google/callback",
      passport.authenticate("google", {
        successRedirect: "/", // 成功したらトップページへ
        failureRedirect: "/", // 失敗してもトップページへ
      })
    );

    this.app.get("/auth/logout", (req: any, res) => {
      req.logout(() => {
        // passport v0.6以上ではコールバックが必要
        res.redirect("/");
      });
    });

    // 現在のユーザー情報を返すAPI
    this.app.get("/api/user", (req, res) => {
      res.send(req.user); // req.user はpassportが自動で設定
    });

    // --- ★ 既存のルートに認証チェックを追加 ★ ---
    const ensureAuth = (req: any, res: any, next: any) => {
      if (req.isAuthenticated()) {
        return next();
      }
      res.status(401).send("Unauthorized");
    };

    // 投稿と更新は認証済みユーザーのみ可能にする
    this.app.post("/api/wishes", ensureAuth, this.wishController.createWish);
    this.app.put("/api/wishes", ensureAuth, this.wishController.updateWish);
    // this.app.post("/api/wishes", this.wishController.createWish);
    // this.app.put("/api/wishes", this.wishController.updateWish);
    this.app.get("/api/wishes/current", this.wishController.getCurrentWish);
    this.app.get("/api/wishes", this.wishController.getLatestWishes);
    this.app.get("/api/user/wish", this.wishController.getUserWish);
    
    // 応援機能のルート
    this.app.post("/api/wishes/:wishId/support", this.wishController.supportWish);
    this.app.delete("/api/wishes/:wishId/support", this.wishController.unsupportWish);
    this.app.get("/api/wishes/:wishId/support", this.wishController.getWishSupportStatus);

    this.app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(path.join(__dirname, "../../../public/index.html"));
    });
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Express server running on port ${port}`);
    });
  }
}
