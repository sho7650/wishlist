import request from "supertest";
import express from "express";
import { Server } from "../../src/infrastructure/web/Server";
import { DatabaseFactory } from "../../src/infrastructure/db/DatabaseFactory";
import { DatabaseWishRepository } from "../../src/adapters/secondary/DatabaseWishRepository";
import { DatabaseSessionService } from "../../src/adapters/secondary/DatabaseSessionService";
import { CreateWishUseCase } from "../../src/application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../src/application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../src/application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../src/application/usecases/GetLatestWishesUseCase";
import { WishController } from "../../src/adapters/primary/WishController";

// インメモリDBを使用するようにする
process.env.DB_TYPE = "sqlite";
process.env.SQLITE_DB_PATH = ":memory:";

describe("API Integration Tests", () => {
  let app: express.Application;
  let server: Server;
  let dbConnection: any;

  beforeAll(async () => {
    // データベース接続をセットアップ
    dbConnection = DatabaseFactory.createConnection();
    await dbConnection.initializeDatabase();

    // リポジトリとサービスを初期化
    const wishRepository = new DatabaseWishRepository(dbConnection);
    const sessionService = new DatabaseSessionService(dbConnection);

    // ユースケースを初期化
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

    // コントローラーを初期化
    const wishController = new WishController(
      createWishUseCase,
      updateWishUseCase,
      getWishBySessionUseCase,
      getLatestWishesUseCase
    );

    // サーバーをセットアップ
    server = new Server(wishController);

    // expressアプリケーションを取得（テスト用）
    app = (server as any).app;
  });

  afterAll(async () => {
    // 後片付け
    await dbConnection.close();
  });

  describe("POST /api/wishes", () => {
    it("should create a new wish", async () => {
      const response = await request(app).post("/api/wishes").send({
        name: "テストユーザー",
        wish: "テストの願い事",
      });

      expect(response.status).toBe(201);
      expect(response.body.wish).toBeDefined();
      expect(response.body.wish.name).toBe("テストユーザー");
      expect(response.body.wish.wish).toBe("テストの願い事");
      expect(response.header["set-cookie"]).toBeDefined(); // セッションクッキーがセットされていること
    });

    it("should return 400 when wish is missing", async () => {
      const response = await request(app).post("/api/wishes").send({
        name: "テストユーザー",
        // wish を省略
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("願い事は必須です");
    });
  });

  describe("GET /api/wishes", () => {
    it("should get latest wishes", async () => {
      const response = await request(app).get("/api/wishes");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.wishes)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request(app).get("/api/wishes?limit=5&offset=0");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.wishes)).toBe(true);
      // 結果数は5以下（データがなければもっと少ない）
      expect(response.body.wishes.length).toBeLessThanOrEqual(5);
    });
  });

  describe("PUT /api/wishes", () => {
    it("should update an existing wish", async () => {
      // まず新しい願い事を作成してセッションIDを取得
      const createResponse = await request(app).post("/api/wishes").send({
        name: "更新前ユーザー",
        wish: "更新前の願い事",
      });

      const cookies = createResponse.header["set-cookie"];

      // 次に更新リクエストを送信
      const updateResponse = await request(app)
        .put("/api/wishes")
        .set("Cookie", cookies)
        .send({
          name: "更新後ユーザー",
          wish: "更新後の願い事",
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.message).toBe("更新しました");

      // 更新されたことを確認
      const getCurrentResponse = await request(app)
        .get("/api/wishes/current")
        .set("Cookie", cookies);

      expect(getCurrentResponse.status).toBe(200);
      expect(getCurrentResponse.body.wish.name).toBe("更新後ユーザー");
      expect(getCurrentResponse.body.wish.wish).toBe("更新後の願い事");
    });

    it("should return 401 when no session provided", async () => {
      const response = await request(app).put("/api/wishes").send({
        name: "ユーザー",
        wish: "願い事",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("編集権限がありません");
    });
  });

  describe("GET /api/wishes/current", () => {
    it("should get current user wish", async () => {
      // まず新しい願い事を作成してセッションIDを取得
      const createResponse = await request(app).post("/api/wishes").send({
        name: "テストユーザー",
        wish: "テストの願い事",
      });

      const cookies = createResponse.header["set-cookie"];

      // 現在の願い事を取得
      const getCurrentResponse = await request(app)
        .get("/api/wishes/current")
        .set("Cookie", cookies);

      expect(getCurrentResponse.status).toBe(200);
      expect(getCurrentResponse.body.wish).toBeDefined();
      expect(getCurrentResponse.body.wish.name).toBe("テストユーザー");
      expect(getCurrentResponse.body.wish.wish).toBe("テストの願い事");
    });

    it("should return null when no session found", async () => {
      const response = await request(app).get("/api/wishes/current");

      expect(response.status).toBe(200);
      expect(response.body.wish).toBeNull();
    });
  });
});
