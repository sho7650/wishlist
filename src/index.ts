// src/index.ts
import "dotenv/config"; // dotenvを一番最初にインポート
import "newrelic";
import passport from "passport";
import { DatabaseFactory } from "./infrastructure/db/DatabaseFactory";
import { DatabaseWishRepositoryAdapter } from "./adapters/secondary/DatabaseWishRepositoryAdapter";
import { DatabaseSessionService } from "./adapters/secondary/DatabaseSessionService";
import { WebServerFactory } from "./infrastructure/web/WebServerFactory";
import { Logger } from "./utils/Logger";
// import { configurePassport } from "./config/express-passport";

async function bootstrap() {
  try {
    Logger.info("[APP] Initializing database connection...");
    // データベース接続
    const dbConnection = DatabaseFactory.createConnection();
    await dbConnection.initializeDatabase();
    Logger.info("[APP] Database initialized successfully");

    // 2. Passportの認証戦略を設定
    //    必ずサーバーを構築する前に実行する
    Logger.info("[APP] Configuring Passport...");
    // configurePassport(passport, dbConnection);
    Logger.info("[APP] Passport configured successfully.");

    // リポジトリとサービスの初期化
    const queryExecutor = DatabaseFactory.createQueryExecutor(dbConnection);
    const wishRepository = new DatabaseWishRepositoryAdapter(queryExecutor);
    const sessionService = new DatabaseSessionService(dbConnection);

    // Webサーバーのインスタンスをファクトリーから取得
    const server = WebServerFactory.createServer(
      dbConnection,
      wishRepository,
      sessionService
    );

    const PORT = parseInt(process.env.PORT || "3000", 10);
    server.start(PORT);
    Logger.info(`[APP] Server running on port ${PORT}`);

    const gracefulShutdown = async (signal: string) => {
      Logger.info(`[APP] Received ${signal}. Shutting down gracefully...`);
      await dbConnection.close();
      Logger.info("[APP] Database connection closed.");
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    Logger.error("[APP] Failed to start application", error as Error);
    process.exit(1);
  }
}

bootstrap();
