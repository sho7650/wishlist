import { DatabaseFactory } from "./infrastructure/db/DatabaseFactory";
import { DatabaseWishRepository } from "./adapters/secondary/DatabaseWishRepository";
import { DatabaseSessionService } from "./adapters/secondary/DatabaseSessionService";
import { CreateWishUseCase } from "./application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "./application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "./application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "./application/usecases/GetLatestWishesUseCase";
import { WishController } from "./adapters/primary/WishController";
import { Server } from "./infrastructure/web/Server";

// 環境変数の設定
const NODE_ENV = process.env.NODE_ENV || "development";
console.log(`Starting application in ${NODE_ENV} mode`);

// アプリケーションの起動処理
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

    // ユースケースの初期化
    const createWishUseCase = new CreateWishUseCase(
      wishRepository,
      sessionService
    );
    const updateWishUseCase = new UpdateWishUseCase(
      wishRepository,
      sessionService
    );
    const getWishBySessionUseCase = new GetWishBySessionUseCase(wishRepository);
    const getLatestWishesUseCase = new GetLatestWishesUseCase(wishRepository);

    // コントローラーの初期化
    const wishController = new WishController(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase
    );

    // サーバーの起動
    const server = new Server(wishController);

    // Herokuが割り当てるポートを使用
    const PORT = parseInt(process.env.PORT || "3000");
    server.start(PORT);
    console.log(`Server running on port ${PORT}`);

    // グレースフルシャットダウン
    process.on("SIGINT", async () => {
      console.log("Shutting down application...");
      await dbConnection.close();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("Heroku is terminating the application...");
      await dbConnection.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error("Unhandled error during bootstrap:", error);
  process.exit(1);
});
