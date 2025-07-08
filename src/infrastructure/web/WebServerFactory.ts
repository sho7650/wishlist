// src/infrastructure/web/WebServerFactory.ts
import { WebServer } from "./WebServer";
import { ExpressServer } from "./ExpressServer";
import { KoaServer } from "./KoaServer";
import { WishController } from "../../adapters/primary/WishController";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";

// ユースケースのインポート
import { CreateWishUseCase } from "../../application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../application/usecases/GetLatestWishesUseCase";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class WebServerFactory {
  static createServer(
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    const framework = process.env.WEB_FRAMEWORK || "express";

    // ユースケースは両方のフレームワークで共通
    const createWishUseCase = new CreateWishUseCase(
      wishRepository,
      sessionService
    );
    const updateWishUseCase = new UpdateWishUseCase(
      wishRepository,
      sessionService
    );
    const getWishBySessionUseCase = new GetWishBySessionUseCase(wishRepository);
    const getLatestWishesUseCase = new GetLatestWishesUseCase(wishRepository);

    if (framework.toLowerCase() === "koa") {
      console.log("Initializing Koa server...");
      const koaWishAdapter = new KoaWishAdapter(
        createWishUseCase,
        updateWishUseCase,
        getWishBySessionUseCase,
        getLatestWishesUseCase
      );
      return new KoaServer(koaWishAdapter);
    } else {
      console.log("Initializing Express server...");
      const wishController = new WishController(
        createWishUseCase,
        updateWishUseCase,
        getWishBySessionUseCase,
        getLatestWishesUseCase
      );
      return new ExpressServer(wishController);
    }
  }
}
