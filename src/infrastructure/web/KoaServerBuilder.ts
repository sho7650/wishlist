import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { WebServer } from "./WebServer";
import { KoaServer } from "./KoaServer";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import {
  CreateWishUseCase,
  UpdateWishUseCase,
  GetWishBySessionUseCase,
  GetLatestWishesUseCase,
} from "../../application/usecases";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class KoaServerBuilder implements ServerBuilderStrategy {
  public build(
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    console.log("Building Koa server with strategy...");

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

    const koaWishAdapter = new KoaWishAdapter(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase
    );

    return new KoaServer(koaWishAdapter);
  }
}
