import request from "supertest";
import { WebServer } from "../../src/infrastructure/web/WebServer";
import { WebServerFactory } from "../../src/infrastructure/web/WebServerFactory";
import { DatabaseFactory } from "../../src/infrastructure/db/DatabaseFactory";
import { DatabaseWishRepository } from "../../src/adapters/secondary/DatabaseWishRepository";
import { DatabaseSessionService } from "../../src/adapters/secondary/DatabaseSessionService";

// インメモリDBを使用
process.env.DB_TYPE = "sqlite";
process.env.SQLITE_DB_PATH = ":memory:";

// テスト対象のフレームワークを配列で定義
const frameworks = ["express", "koa"];

// フレームワークごとにテストスイートを実行
describe.each(frameworks)("API Integration Tests with %s", (framework) => {
  let app: any; // expressインスタンスまたはkoaのリスナー
  let dbConnection: any;

  beforeAll(async () => {
    // 環境変数を設定して、テスト対象のサーバーを切り替える
    process.env.WEB_FRAMEWORK = framework;

    // データベース接続をセットアップ
    dbConnection = DatabaseFactory.createConnection();
    await dbConnection.initializeDatabase();

    // 依存関係を準備
    const wishRepository = new DatabaseWishRepository(dbConnection);
    const sessionService = new DatabaseSessionService(dbConnection);

    // ファクトリーからサーバーインスタンスを取得
    const server = WebServerFactory.createServer(
      wishRepository,
      sessionService
    );

    // supertestが扱えるように、内部のアプリケーションインスタンスを取得
    // Koaの場合は .callback() を使う
    if (framework === "koa") {
      app = (server as any).app.callback();
    } else {
      app = (server as any).app;
    }
  });

  afterAll(async () => {
    // テストスイートの最後にDB接続を閉じる
    await dbConnection.close();
  });

  // 各テストケースは変更なし
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
      expect(response.header["set-cookie"]).toBeDefined();
    });

    it("should return 400 when wish is missing", async () => {
      const response = await request(app)
        .post("/api/wishes")
        .send({ name: "テストユーザー" });

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
  });

  describe("PUT /api/wishes", () => {
    it("should update an existing wish", async () => {
      // 事前に投稿を作成
      const createResponse = await request(app)
        .post("/api/wishes")
        .send({ name: "更新前", wish: "更新前の願い" });
      const cookies = createResponse.header["set-cookie"];

      // 更新リクエスト
      const updateResponse = await request(app)
        .put("/api/wishes")
        .set("Cookie", cookies)
        .send({ name: "更新後", wish: "更新後の願い" });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.message).toBe("更新しました");
    });

    it("should return 401 when no session provided", async () => {
      const response = await request(app)
        .put("/api/wishes")
        .send({ name: "ユーザー", wish: "願い事" });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("編集権限がありません");
    });
  });

  describe("GET /api/wishes/current", () => {
    it("should get current user wish", async () => {
      // 事前に投稿を作成
      const createResponse = await request(app)
        .post("/api/wishes")
        .send({ name: "カレントユーザー", wish: "カレントの願い" });
      const cookies = createResponse.header["set-cookie"];

      // 現在の願い事を取得
      const getCurrentResponse = await request(app)
        .get("/api/wishes/current")
        .set("Cookie", cookies);

      expect(getCurrentResponse.status).toBe(200);
      expect(getCurrentResponse.body.wish).toBeDefined();
      expect(getCurrentResponse.body.wish.name).toBe("カレントユーザー");
    });
  });
});
