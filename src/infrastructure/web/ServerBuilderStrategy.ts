import { WebServer } from "./WebServer";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { QueryExecutor } from "../db/query/QueryExecutor";
import { DatabaseConnection } from "../db/DatabaseConnection";

export interface ServerBuilderStrategy {
  build(
    dbConnection: DatabaseConnection,
    wishRepository: WishRepository,
    sessionService: SessionService,
    queryExecutor?: QueryExecutor
  ): WebServer;
}
