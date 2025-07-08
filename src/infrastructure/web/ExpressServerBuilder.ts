import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { WebServer } from "./WebServer";
import { ExpressServer } from "./ExpressServer";
import { WishController } from "../../adapters/primary/WishController";
import {
  CreateWishUseCase,
  UpdateWishUseCase,
  GetWishBySessionUseCase,
  GetLatestWishesUseCase,
} from "../../application/usecases"; // usecases/index.ts などでまとめると綺麗
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class ExpressServerBuilder implements ServerBuilderStrategy {
  public build(
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    console.log("Building Express server with strategy...");

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

    const wishController = new WishController(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase
    );

    return new ExpressServer(wishController);
  }
}
