import { WebServer } from "./WebServer";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export interface ServerBuilderStrategy {
  build(
    dbConnection: any,
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer;
}
