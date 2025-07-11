import { DatabaseWishRepository } from "../../../../src/adapters/secondary/DatabaseWishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";

// データベース接続をモック
const mockDbConnection = {
  query: jest.fn(),
  initializeDatabase: jest.fn(),
  close: jest.fn(),
};

describe("DatabaseWishRepository", () => {
  let repository: DatabaseWishRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DatabaseWishRepository(mockDbConnection);
  });

  describe("save", () => {
    it("should save a wish to the database", async () => {
      // モックの設定
      const wish = new Wish({
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        createdAt: new Date("2025-01-01"),
        userId: 1,
      });

      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // 実行
      await repository.save(wish, wish.userId);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO wishes"),
        [wish.id, wish.name, wish.wish, wish.createdAt, wish.userId, wish.supportCount]
      );
    });

    it("should handle wish without name", async () => {
      // 名前がない願い事
      const wish = new Wish({
        id: "123",
        wish: "テストの願い事",
        createdAt: new Date("2025-01-01"),
        userId: 1, // ユーザーIDを追加
      });

      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // 実行
      await repository.save(wish, wish.userId);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO wishes"),
        [wish.id, null, wish.wish, wish.createdAt, wish.userId, wish.supportCount]
      );
    });
  });

  describe("findById", () => {
    it("should find a wish by id", async () => {
      // モックの設定
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1, // ユーザーIDを追加
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      // 実行
      const result = await repository.findById("123");

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM wishes WHERE id = $1"),
        ["123"]
      );

      expect(result).toBeInstanceOf(Wish);
      expect(result?.id).toBe("123");
      expect(result?.name).toBe("テスト太郎");
      expect(result?.wish).toBe("テストの願い事");
      expect(result?.createdAt).toEqual(new Date("2025-01-01"));
    });

    it("should return null when wish not found", async () => {
      // 願い事が見つからない場合
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      // 実行
      const result = await repository.findById("non-existent-id");

      // 検証
      expect(result).toBeNull();
    });
  });

  describe("findBySessionId", () => {
    it("should find a wish by session id", async () => {
      // モックの設定
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01T00:00:00.000Z"), // ⭐️ 日付オブジェクトに変更
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      // 実行
      const result = await repository.findBySessionId("test-session-id");

      // 👇 ここを修正します
      // 検証
      // 1. queryメソッドが1回呼ばれたことを確認
      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);

      // 2. 呼ばれた際の引数を個別に検証
      const [query, params] = mockDbConnection.query.mock.calls[0];

      // クエリ文字列に必要な部分が含まれているかを確認
      expect(query).toContain("SELECT w.*");
      expect(query).toContain("FROM wishes w");
      expect(query).toContain("JOIN sessions s ON w.id = s.wish_id");
      expect(query).toContain("WHERE s.session_id = $1");

      // パラメータが正しいかを確認
      expect(params).toEqual(["test-session-id"]);

      // 返り値の検証
      expect(result).toBeInstanceOf(Wish);
      expect(result?.id).toBe("123");
    });
  });

  describe("findLatest", () => {
    it("should find latest wishes with limit and offset", async () => {
      // モックの設定
      const mockRows = [
        {
          id: "1",
          name: "ユーザー1",
          wish: "願い事1",
          created_at: new Date("2025-01-01"),
        },
        {
          id: "2",
          name: "ユーザー2",
          wish: "願い事2",
          created_at: new Date("2025-01-02"),
        },
      ];

      mockDbConnection.query.mockResolvedValue({
        rows: mockRows,
        rowCount: 2,
      });

      // 実行
      const result = await repository.findLatest(10, 20);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "SELECT * FROM wishes ORDER BY created_at DESC LIMIT $1 OFFSET $2"
        ),
        [10, 20]
      );

      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Wish);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });

    it("should use default offset when not provided", async () => {
      // モックの設定
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      // 実行
      await repository.findLatest(10);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $1 OFFSET $2"),
        [10, 0]
      );
    });
  });

  describe("parseDate", () => {
    it("should handle invalid date strings", async () => {
      // モックの設定
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: "invalid-date",
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      // コンソールの警告をスパイ
      jest.spyOn(console, "warn").mockImplementation();

      // 実行
      const result = await repository.findById("123");

      // 検証
      expect(result).toBeInstanceOf(Wish);
      expect(result?.createdAt).toBeInstanceOf(Date);
      // 無効な日付の場合、現在日時に近い値が設定されているはず
      const now = new Date();
      const diff = Math.abs(result!.createdAt.getTime() - now.getTime());
      expect(diff).toBeLessThan(5000); // 5秒以内の差であること
    });
  });
});
