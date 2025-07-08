// src/index.ts
// import "dotenv/config"; // dotenvを一番最初にインポート
import { DatabaseFactory } from "./infrastructure/db/DatabaseFactory";
import { DatabaseWishRepository } from "./adapters/secondary/DatabaseWishRepository";
import { DatabaseSessionService } from "./adapters/secondary/DatabaseSessionService";
import { WebServerFactory } from "./infrastructure/web/WebServerFactory";

async function bootstrap() {
  try {
    console.log("Initializing database connection...");
    // データベース接続
    const dbConnection = DatabaseFactory.createConnection();
    await dbConnection.initializeDatabase();
    console.log("Database initialized successfully");

    // リポジトリとサービスの初期化
    const wishRepository = new DatabaseWishRepository(dbConnection);
    const sessionService = new DatabaseSessionService(dbConnection);

    // Webサーバーのインスタンスをファクトリーから取得
    const server = WebServerFactory.createServer(
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
