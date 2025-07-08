import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { WishController } from "../../adapters/primary/WishController";

export class Server {
  private app = express();

  constructor(private wishController: WishController) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "../../../public")));
    this.app.use(cookieParser());
  }

  private setupRoutes() {
    // API エンドポイント
    this.app.post("/api/wishes", this.wishController.createWish);
    this.app.put("/api/wishes", this.wishController.updateWish);
    this.app.get("/api/wishes/current", this.wishController.getCurrentWish);
    this.app.get("/api/wishes", this.wishController.getLatestWishes);

    this.app.get(/.*/, (req, res) => {
      // APIリクエストでない場合のみindex.htmlを返すようにする
      if (!req.path.startsWith("/api/")) {
        res.sendFile(path.join(__dirname, "../../../public/index.html"));
      }
    });
  }

  start(port?: number) {
    const serverPort = port || parseInt(process.env.PORT || "3000");
    this.app.listen(serverPort, () => {
      console.log(`Server running on port ${serverPort}`);
    });
  }
}
