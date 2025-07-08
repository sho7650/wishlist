import { WebServer } from "./WebServer";
import { ServerBuilderStrategy } from "./ServerBuilderStrategy";
import { ExpressServerBuilder } from "./ExpressServerBuilder";
import { KoaServerBuilder } from "./KoaServerBuilder";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class WebServerFactory {
  private static strategies: { [key: string]: ServerBuilderStrategy } = {
    express: new ExpressServerBuilder(),
    koa: new KoaServerBuilder(),
  };

  static createServer(
    wishRepository: WishRepository,
    sessionService: SessionService
  ): WebServer {
    const framework = (process.env.WEB_FRAMEWORK || "express").toLowerCase();

    const builder = this.strategies[framework];

    if (!builder) {
      throw new Error(`Unsupported web framework: ${framework}`);
    }

    return builder.build(wishRepository, sessionService);
  }
}
