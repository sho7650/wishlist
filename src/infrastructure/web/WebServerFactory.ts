import { WebServer } from "./WebServer";
import passport, { Passport, PassportStatic } from "passport";
import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { ExpressServerBuilder } from "./ExpressServerBuilder";
import { KoaServerBuilder } from "./KoaServerBuilder";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { QueryExecutor } from "../db/query/QueryExecutor";
import { DatabaseConnection } from "../db/DatabaseConnection";

export class WebServerFactory {
  private static strategies: { [key: string]: ServerBuilderStrategy } = {
    express: new ExpressServerBuilder(),
    koa: new KoaServerBuilder(),
  };

  static createServer(
    dbConnection: DatabaseConnection,
    wishRepository: WishRepository,
    sessionService: SessionService,
    queryExecutor?: QueryExecutor
  ): WebServer {
    const framework = (process.env.WEB_FRAMEWORK || "express").toLowerCase();

    const builder = this.strategies[framework];

    if (!builder) {
      throw new Error(`Unsupported web framework: ${framework}`);
    }
    if (framework === "koa") {
      return new KoaServerBuilder().build(
        dbConnection,
        wishRepository,
        sessionService,
        queryExecutor
      );
    }

    // Expressの場合
    return new ExpressServerBuilder().build(
      dbConnection,
      wishRepository,
      sessionService,
      queryExecutor
    );
  }
}
