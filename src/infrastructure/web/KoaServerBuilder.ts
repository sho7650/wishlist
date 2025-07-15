import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { WebServer } from "./WebServer";
import { KoaServer } from "./KoaServer";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import { Logger } from "../../utils/Logger";
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
import { WishService } from "../../application/services/WishService";
import { EventPublisher } from "../../ports/output/EventPublisher";
import { MockEventPublisher } from "../../adapters/secondary/MockEventPublisher";
import { AuthenticationService } from "../../application/services/AuthenticationService";
import { KoaAuthenticationAdapter } from "../../adapters/primary/KoaAuthenticationAdapter";
import { UserRepositoryPort } from "../../ports/UserRepositoryPort";
import { DatabaseUserRepositoryAdapter } from "../../adapters/secondary/DatabaseUserRepositoryAdapter";
import { QueryExecutor } from "../db/query/QueryExecutor";

export class KoaServerBuilder implements ServerBuilderStrategy {
  public build(
    dbConnection: any, // ここは実際のDB接続型に置き換える
    wishRepository: WishRepository,
    sessionService: SessionService,
    queryExecutor?: QueryExecutor
  ): WebServer {
    Logger.debug("[WEB] Building Koa server with strategy");

    // Create dependencies for WishService
    const eventPublisher: EventPublisher = new MockEventPublisher();
    const wishService = new WishService(wishRepository, sessionService, eventPublisher);

    // Create authentication dependencies
    let authenticationAdapter: KoaAuthenticationAdapter | undefined;
    if (queryExecutor) {
      const userRepository: UserRepositoryPort = new DatabaseUserRepositoryAdapter(queryExecutor);
      const authenticationService = new AuthenticationService(userRepository, eventPublisher);
      authenticationAdapter = new KoaAuthenticationAdapter(authenticationService);
    }

    const createWishUseCase = new CreateWishUseCase(wishService);
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

    return new KoaServer(dbConnection, koaWishAdapter, authenticationAdapter);
  }
}
