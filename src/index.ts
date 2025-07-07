import { DatabaseFactory } from './infrastructure/db/DatabaseFactory';
import { DatabaseWishRepository } from './adapters/secondary/DatabaseWishRepository';
import { DatabaseSessionService } from './adapters/secondary/DatabaseSessionService';
import { CreateWishUseCase } from './application/usecases/CreateWishUseCase';
import { UpdateWishUseCase } from './application/usecases/UpdateWishUseCase';
import { GetWishBySessionUseCase } from './application/usecases/GetWishBySessionUseCase';
import { GetLatestWishesUseCase } from './application/usecases/GetLatestWishesUseCase';
import { WishController } from './adapters/primary/WishController';
import { Server } from './infrastructure/web/Server';

// アプリケーションの起動処理
async function bootstrap() {
  // データベース接続
  const dbConnection = DatabaseFactory.createConnection();
  await dbConnection.initializeDatabase();
  
  // リポジトリとサービスの初期化
  const wishRepository = new DatabaseWishRepository(dbConnection);
  const sessionService = new DatabaseSessionService(dbConnection);
  
  // ユースケースの初期化
  const createWishUseCase = new CreateWishUseCase(wishRepository, sessionService);
  const updateWishUseCase = new UpdateWishUseCase(wishRepository, sessionService);
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
  server.start(3000);
  
  // グレースフルシャットダウン
  process.on('SIGINT', async () => {
    console.log('Shutting down application...');
    await dbConnection.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);
