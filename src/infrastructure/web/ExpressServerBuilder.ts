import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { WebServer } from "./WebServer";
import { ExpressServer } from "./ExpressServer";
import { WishController } from "../../adapters/primary/WishController";
import {
  CreateWishUseCase,
  UpdateWishUseCase,
  GetWishBySessionUseCase,
  GetLatestWishesUseCase,
  GetUserWishUseCase,
  SupportWishUseCase,
  UnsupportWishUseCase,
  GetWishSupportStatusUseCase,
} from "../../application/usecases"; // usecases/index.ts などでまとめると綺麗
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { PassportStatic } from "passport";

export class ExpressServerBuilder implements ServerBuilderStrategy {
  public build(
    dbConnection: any, // ここは実際のDB接続型に置き換える
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    console.log("Building Express server with strategy...");

    const createWishUseCase = new CreateWishUseCase(
      wishRepository,
      sessionService
    );
    const updateWishUseCase = new UpdateWishUseCase(wishRepository);
    const getWishBySessionUseCase = new GetWishBySessionUseCase(wishRepository);
    const getLatestWishesUseCase = new GetLatestWishesUseCase(wishRepository);
    const getUserWishUseCase = new GetUserWishUseCase(wishRepository);
    const supportWishUseCase = new SupportWishUseCase(wishRepository);
    const unsupportWishUseCase = new UnsupportWishUseCase(wishRepository);
    const getWishSupportStatusUseCase = new GetWishSupportStatusUseCase(wishRepository);

    const wishController = new WishController(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase,
      getUserWishUseCase,
      supportWishUseCase,
      unsupportWishUseCase,
      getWishSupportStatusUseCase
    );

    return new ExpressServer(dbConnection, wishController);
  }
}
