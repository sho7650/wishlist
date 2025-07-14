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
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { PassportStatic } from "passport";
import { WishService } from "../../application/services/WishService";
import { EventPublisher } from "../../ports/output/EventPublisher";
import { MockEventPublisher } from "../../adapters/secondary/MockEventPublisher";
import { AuthenticationService } from "../../application/services/AuthenticationService";
import { ExpressAuthenticationAdapter } from "../../adapters/primary/ExpressAuthenticationAdapter";
import { UserRepositoryPort } from "../../ports/UserRepositoryPort";
import { DatabaseUserRepositoryAdapter } from "../../adapters/secondary/DatabaseUserRepositoryAdapter";
import { QueryExecutor } from "../db/query/QueryExecutor";

export class ExpressServerBuilder implements ServerBuilderStrategy {
  public build(
    dbConnection: any, // ここは実際のDB接続型に置き換える
    wishRepository: WishRepository,
    sessionService: SessionService,
    queryExecutor?: QueryExecutor
  ): WebServer {
    console.log("Building Express server with strategy...");

    // Create dependencies for WishService
    const eventPublisher: EventPublisher = new MockEventPublisher();
    const wishService = new WishService(wishRepository, sessionService, eventPublisher);

    // Create authentication dependencies
    let authenticationAdapter: ExpressAuthenticationAdapter | undefined;
    if (queryExecutor) {
      const userRepository: UserRepositoryPort = new DatabaseUserRepositoryAdapter(queryExecutor);
      const authenticationService = new AuthenticationService(userRepository, eventPublisher);
      authenticationAdapter = new ExpressAuthenticationAdapter(authenticationService);
    }

    const createWishUseCase = new CreateWishUseCase(wishService);
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

    return new ExpressServer(dbConnection, wishController, authenticationAdapter);
  }
}
