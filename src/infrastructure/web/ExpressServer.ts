// src/infrastructure/web/ExpressServer.ts
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import { WishController } from "../../adapters/primary/WishController";
import { WebServer } from "./WebServer";

export class ExpressServer implements WebServer {
  private app = express();

  constructor(private wishController: WishController) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../../../public")));
    this.app.use(cookieParser());
  }

  private setupRoutes(): void {
    this.app.post("/api/wishes", this.wishController.createWish);
    this.app.put("/api/wishes", this.wishController.updateWish);
    this.app.get("/api/wishes/current", this.wishController.getCurrentWish);
    this.app.get("/api/wishes", this.wishController.getLatestWishes);

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
