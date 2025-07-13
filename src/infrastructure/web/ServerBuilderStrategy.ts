import { WebServer } from "./WebServer";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export interface ServerBuilderStrategy {
  build(
    dbConnection: any,
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer;
}
