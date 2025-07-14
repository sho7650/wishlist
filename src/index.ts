// src/index.ts
import "dotenv/config"; // dotenvを一番最初にインポート
import "newrelic";
import passport from "passport";
import { DatabaseFactory } from "./infrastructure/db/DatabaseFactory";
import { DatabaseWishRepositoryAdapter } from "./adapters/secondary/DatabaseWishRepositoryAdapter";
import { DatabaseSessionService } from "./adapters/secondary/DatabaseSessionService";
import { WebServerFactory } from "./infrastructure/web/WebServerFactory";
// import { configurePassport } from "./config/express-passport";

async function bootstrap() {
  try {
    console.log("Initializing database connection...");
    // データベース接続
    const dbConnection = DatabaseFactory.createConnection();
    await dbConnection.initializeDatabase();
    console.log("Database initialized successfully");

    // 2. Passportの認証戦略を設定
    //    必ずサーバーを構築する前に実行する
    console.log("Configuring Passport...");
    // configurePassport(passport, dbConnection);
    console.log("Passport configured successfully.");

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
    console.log(`Server running on port ${PORT}`);

    const gracefulShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      await dbConnection.close();
      console.log("Database connection closed.");
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap();
