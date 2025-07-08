import { PostgresConnection } from "../../../../src/infrastructure/db/PostgresConnection";
import { Pool } from "pg";

// --- pgモジュール全体のモック化 ---
// モックのクライアントとプールを定義
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(() => Promise.resolve(mockClient)),
  end: jest.fn(),
};

// 'pg'がインポートされたら、Poolクラスのコンストラクタが呼ばれた際に
// 上で定義したmockPoolを返すように設定する
jest.mock("pg", () => ({
  Pool: jest.fn(() => mockPool),
}));

// --- pg-connection-stringモジュールのモック化 ---
// このテストではparseDbUrlは直接使わないが、インポートされているのでモックが必要
jest.mock("pg-connection-string", () => ({
  parse: jest.fn((url) => ({
    // parseが返すオブジェクトの形式を模倣
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })),
}));

// --- テストスイート ---
describe("PostgresConnection", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 各テストの前にモックと環境変数をリセット
    jest.clearAllMocks();
    mockClient.query.mockReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // 全テスト終了後に環境変数を元に戻す
    process.env = originalEnv;
  });

  describe("Constructor", () => {
    it("should use DATABASE_URL for connection when it is set (Heroku environment)", () => {
      const databaseUrl = "postgres://user:pass@host:5432/db";
      process.env.DATABASE_URL = databaseUrl;

      new PostgresConnection();

      // Poolコンストラクタが正しい設定で呼ばれたか検証
      expect(Pool).toHaveBeenCalledWith({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
      });
    });

    it("should use individual DB environment variables when DATABASE_URL is not set", () => {
      // DATABASE_URLを未定義にする
      delete process.env.DATABASE_URL;

      // ローカル用の環境変数を設定
      process.env.DB_HOST = "test-host";
      process.env.DB_PORT = "1234";
      process.env.DB_NAME = "test-db";
      process.env.DB_USER = "test-user";
      process.env.DB_PASSWORD = "test-password";

      new PostgresConnection();

      // Poolコンストラクタが正しい設定で呼ばれたか検証
      expect(Pool).toHaveBeenCalledWith({
        host: "test-host",
        port: 1234,
        database: "test-db",
        user: "test-user",
        password: "test-password",
      });
    });
  });

  describe("query", () => {
    it("should connect, query, release, and return formatted results", async () => {
      const connection = new PostgresConnection();

      // モックのクエリ結果を設定
      const mockQueryResult = {
        rows: [{ id: 1, name: "test" }],
        rowCount: 1,
      };
      mockClient.query.mockResolvedValue(mockQueryResult);

      const sql = "SELECT * FROM users WHERE id = $1";
      const params = [1];
      const result = await connection.query(sql, params);

      // 期待される動作を検証
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith(sql, params);
      expect(mockClient.release).toHaveBeenCalledTimes(1);

      // 結果が正しくフォーマットされているか検証
      expect(result).toEqual({
        rows: [{ id: 1, name: "test" }],
        rowCount: 1,
      });
    });

    it("should release the client even if the query fails", async () => {
      const connection = new PostgresConnection();

      // クエリが失敗するようにモックを設定
      const queryError = new Error("SQL syntax error");
      mockClient.query.mockRejectedValue(queryError);

      const sql = "INVALID SQL";
      const params: any[] = [];

      // エラーがスローされることを検証
      await expect(connection.query(sql, params)).rejects.toThrow(queryError);

      // エラーが発生しても、client.release()が呼ばれることを確認
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("should call pool.end to close the connection", async () => {
      const connection = new PostgresConnection();
      await connection.close();
      expect(mockPool.end).toHaveBeenCalledTimes(1);
    });
  });

  describe("initializeDatabase", () => {
    it("should execute a CREATE TABLE query", async () => {
      const connection = new PostgresConnection();
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
      // queryメソッドが呼ばれることをスパイしておく
      const querySpy = jest.spyOn(connection, "query");

      // initializeDatabaseを実行
      await connection.initializeDatabase();

      // queryメソッドがCREATE TABLE文で呼ばれたことを検証
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS wishes"),
        []
      );
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS sessions"),
        []
      );
    });
  });
});
