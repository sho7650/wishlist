import { DatabaseSessionService } from "../../../../src/adapters/secondary/DatabaseSessionService";
import { DatabaseConnection } from "../../../../src/infrastructure/db/DatabaseConnection";

// 依存するDatabaseConnectionのモックを作成
// jest.fn() を使って、各メソッドの呼び出しをスパイできるようにする
const mockDbConnection: jest.Mocked<DatabaseConnection> = {
  query: jest.fn(),
  initializeDatabase: jest.fn(),
  close: jest.fn(),
};

describe("DatabaseSessionService", () => {
  let service: DatabaseSessionService;

  // 各テストの実行前に、モックをクリアし、サービスを再インスタンス化する
  beforeEach(() => {
    jest.clearAllMocks();
    service = new DatabaseSessionService(mockDbConnection);
  });

  describe("generateSessionId", () => {
    it("should generate a 32-character hex string", () => {
      // act
      const sessionId = service.generateSessionId();

      // assert
      // crypto.randomBytes(16) は 16バイトのデータを生成し、
      // 'hex'エンコーディングで32文字の16進数文字列になる
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBe(32);
      expect(sessionId).toMatch(/^[a-f0-9]{32}$/); // 16進数文字列であることを正規表現で確認
    });
  });

  describe("linkSessionToWish", () => {
    const sessionId = "test-session-id-123";
    const wishId = "test-wish-id-456";

    it("should execute an INSERT query with the correct SQL and parameters", async () => {
      // arrange
      // db.queryが成功したことにする
      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // act
      await service.linkSessionToWish(sessionId, wishId);

      // assert
      // db.queryが1回だけ呼び出されたことを確認
      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);
      // db.queryに正しい引数が渡されたことを確認
      // 3番目の引数（日付）は動的に生成されるため、expect.any(String)で型のみをチェック
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        "INSERT INTO sessions (session_id, wish_id, created_at) VALUES ($1, $2, $3)",
        [sessionId, wishId, expect.any(String)]
      );
    });

    it("should throw an error if the database query fails", async () => {
      // arrange
      const dbError = new Error("Unique constraint violation");
      // db.queryが失敗したことにする
      mockDbConnection.query.mockRejectedValue(dbError);

      // act & assert
      // メソッドの実行が、dbErrorをスローして失敗することを確認
      await expect(
        service.linkSessionToWish(sessionId, wishId)
      ).rejects.toThrow(dbError);
    });
  });

  describe("getWishIdBySession", () => {
    const sessionId = "session-to-find-789";

    it("should return the wish_id when a session is found", async () => {
      // arrange
      const expectedWishId = "found-wish-id-abc";
      // db.queryが成功し、1件のレコードを返したことにする
      mockDbConnection.query.mockResolvedValue({
        rows: [{ wish_id: expectedWishId }],
        rowCount: 1,
      });

      // act
      const result = await service.getWishIdBySession(sessionId);

      // assert
      expect(result).toBe(expectedWishId);
      // db.queryが正しい引数で呼び出されたことを確認
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        "SELECT wish_id FROM sessions WHERE session_id = $1",
        [sessionId]
      );
      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);
    });

    it("should return null when a session is not found", async () => {
      // arrange
      // db.queryが成功したが、結果が0件だったことにする
      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 0 });

      // act
      const result = await service.getWishIdBySession(sessionId);

      // assert
      expect(result).toBeNull();
      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if the database query fails", async () => {
      // arrange
      const dbError = new Error("Database connection lost");
      mockDbConnection.query.mockRejectedValue(dbError);

      // act & assert
      await expect(service.getWishIdBySession(sessionId)).rejects.toThrow(
        dbError
      );
    });
  });
});
