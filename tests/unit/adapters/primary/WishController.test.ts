import { WishController } from "../../../../src/adapters/primary/WishController";
import { Wish } from "../../../../src/domain/entities/Wish";
import { CreateWishUseCase } from "../../../../src/application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../../../src/application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../../../src/application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../../../src/application/usecases/GetLatestWishesUseCase";

// Express のリクエスト・レスポンスをモック
const mockRequest = () => {
  const req: any = {};
  req.body = {};
  req.cookies = {};
  req.query = {};
  return req;
};

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

// ユースケースをモック
const mockCreateWishUseCase = {
  execute: jest.fn(),
};

const mockUpdateWishUseCase = {
  execute: jest.fn(),
};

const mockGetWishBySessionUseCase = {
  execute: jest.fn(),
};

const mockGetLatestWishesUseCase = {
  execute: jest.fn(),
};

describe("WishController", () => {
  let wishController: WishController;

  beforeEach(() => {
    jest.clearAllMocks();
    // WishControllerのインスタンスを作成
    wishController = new WishController(
      mockCreateWishUseCase as unknown as CreateWishUseCase,
      mockUpdateWishUseCase as unknown as UpdateWishUseCase,
      mockGetWishBySessionUseCase as unknown as GetWishBySessionUseCase,
      mockGetLatestWishesUseCase as unknown as GetLatestWishesUseCase
    );
  });

  describe("createWish", () => {
    it("should create a wish successfully", async () => {
      // モックの設定
      const req = mockRequest();
      req.body = { name: "テスト太郎", wish: "テストの願い事" };

      const res = mockResponse();

      const mockWish = new Wish({
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        createdAt: new Date(),
      });

      mockCreateWishUseCase.execute.mockResolvedValue({
        wish: mockWish,
        sessionId: "test-session-id",
      });

      // 実行
      await wishController.createWish(req, res);

      // 検証
      expect(mockCreateWishUseCase.execute).toHaveBeenCalledWith(
        "テスト太郎",
        "テストの願い事",
        undefined
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "sessionId",
        "test-session-id",
        expect.any(Object)
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ wish: mockWish });
    });

    it("should return 400 when wish is missing", async () => {
      // wishが空の場合
      const req = mockRequest();
      req.body = { name: "テスト太郎" };

      const res = mockResponse();

      // 実行
      await wishController.createWish(req, res);

      // 検証
      expect(mockCreateWishUseCase.execute).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "願い事は必須です" });
    });

    it("should handle existing session", async () => {
      // セッションIDが既に存在する場合
      const req = mockRequest();
      req.body = { name: "テスト太郎", wish: "テストの願い事" };
      req.cookies.sessionId = "existing-session-id";

      const res = mockResponse();

      const mockWish = new Wish({
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        createdAt: new Date(),
      });

      mockCreateWishUseCase.execute.mockResolvedValue({
        wish: mockWish,
        sessionId: "existing-session-id",
      });

      // 実行
      await wishController.createWish(req, res);

      // 検証
      expect(mockCreateWishUseCase.execute).toHaveBeenCalledWith(
        "テスト太郎",
        "テストの願い事",
        "existing-session-id"
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "sessionId",
        "existing-session-id",
        expect.any(Object)
      );
    });

    it("should handle errors from use case", async () => {
      // ユースケースがエラーを投げる場合
      const req = mockRequest();
      req.body = { name: "テスト太郎", wish: "テストの願い事" };

      const res = mockResponse();

      mockCreateWishUseCase.execute.mockRejectedValue(
        new Error("既に投稿済みです")
      );

      // 実行
      await wishController.createWish(req, res);

      // 検証
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "既に投稿済みです" });
    });
  });

  // 他のメソッドのテストも同様に記述
  describe("updateWish", () => {
    it("should update a wish successfully", async () => {
      // モックの設定
      const req = mockRequest();
      req.body = { name: "新しい名前", wish: "新しい願い事" };
      req.cookies.sessionId = "test-session-id";

      const res = mockResponse();

      // 実行
      await wishController.updateWish(req, res);

      // 検証
      expect(mockUpdateWishUseCase.execute).toHaveBeenCalledWith(
        "test-session-id",
        "新しい名前",
        "新しい願い事"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "更新しました" });
    });

    // 他のケースも同様にテスト
  });

  describe("getCurrentWish", () => {
    it("should get current wish by session", async () => {
      // モックの設定
      const req = mockRequest();
      req.cookies.sessionId = "test-session-id";

      const res = mockResponse();

      const mockWish = new Wish({
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        createdAt: new Date(),
      });

      mockGetWishBySessionUseCase.execute.mockResolvedValue(mockWish);

      // 実行
      await wishController.getCurrentWish(req, res);

      // 検証
      expect(mockGetWishBySessionUseCase.execute).toHaveBeenCalledWith(
        "test-session-id"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: mockWish });
    });

    // 他のケースも同様にテスト
  });

  describe("getLatestWishes", () => {
    it("should get latest wishes with pagination", async () => {
      // モックの設定
      const req = mockRequest();
      req.query = { limit: "10", offset: "20" };

      const res = mockResponse();

      const mockWishes = [
        new Wish({ id: "1", wish: "願い事1", createdAt: new Date() }),
        new Wish({ id: "2", wish: "願い事2", createdAt: new Date() }),
      ];

      mockGetLatestWishesUseCase.execute.mockResolvedValue(mockWishes);

      // 実行
      await wishController.getLatestWishes(req, res);

      // 検証
      expect(mockGetLatestWishesUseCase.execute).toHaveBeenCalledWith(10, 20);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wishes: mockWishes });
    });

    // 他のケースも同様にテスト
  });
});
