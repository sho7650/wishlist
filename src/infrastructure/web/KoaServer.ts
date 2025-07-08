// src/infrastructure/web/KoaServer.ts
import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import helmet from "koa-helmet";
import path from "path";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import { WebServer } from "./WebServer";
import fs from "fs";

export class KoaServer implements WebServer {
  private app: Koa;
  private router: Router;

  constructor(private koaWishAdapter: KoaWishAdapter) {
    this.app = new Koa();
    this.router = new Router();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(bodyParser());
    this.app.use(serve(path.join(__dirname, "../../../public")));
  }

  private setupRoutes(): void {
    this.router.post("/api/wishes", this.koaWishAdapter.createWish);
    this.router.put("/api/wishes", this.koaWishAdapter.updateWish);
    this.router.get("/api/wishes/current", this.koaWishAdapter.getCurrentWish);
    this.router.get("/api/wishes", this.koaWishAdapter.getLatestWishes);

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

  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Koa server running on port ${port}`);
    });
  }
}
