import { WebServer } from "./WebServer";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { QueryExecutor } from "../db/query/QueryExecutor";

export interface ServerBuilderStrategy {
  build(
    dbConnection: any,
    wishRepository: WishRepository,
    sessionService: SessionService,
    queryExecutor?: QueryExecutor
  ): WebServer;
}
