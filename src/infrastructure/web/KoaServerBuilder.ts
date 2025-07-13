import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { WebServer } from "./WebServer";
import { KoaServer } from "./KoaServer";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import {
  CreateWishUseCase,
  UpdateWishUseCase,
  GetWishBySessionUseCase,
  GetLatestWishesUseCase,
  GetUserWishUseCase,
  SupportWishUseCase,
  UnsupportWishUseCase,
  GetWishSupportStatusUseCase,
} from "../../application/usecases";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class KoaServerBuilder implements ServerBuilderStrategy {
  public build(
    dbConnection: any, // ここは実際のDB接続型に置き換える
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    console.log("Building Koa server with strategy...");

    const createWishUseCase = new CreateWishUseCase(wishRepository as any);
    const updateWishUseCase = new UpdateWishUseCase(wishRepository);
    const getWishBySessionUseCase = new GetWishBySessionUseCase(wishRepository);
    const getLatestWishesUseCase = new GetLatestWishesUseCase(wishRepository);
    const getUserWishUseCase = new GetUserWishUseCase(wishRepository);
    const supportWishUseCase = new SupportWishUseCase(wishRepository);
    const unsupportWishUseCase = new UnsupportWishUseCase(wishRepository);
    const getWishSupportStatusUseCase = new GetWishSupportStatusUseCase(wishRepository);

    const koaWishAdapter = new KoaWishAdapter(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase,
      getUserWishUseCase,
      supportWishUseCase,
      unsupportWishUseCase,
      getWishSupportStatusUseCase
    );

    return new KoaServer(dbConnection, koaWishAdapter);
  }
}
