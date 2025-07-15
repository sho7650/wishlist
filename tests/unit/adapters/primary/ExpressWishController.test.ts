import { WishController } from "../../../../src/adapters/primary/ExpressWishController";
import { Wish } from "../../../../src/domain/entities/Wish";
import { CreateWishUseCase } from "../../../../src/application/usecases/CreateWishUseCase";
import { UpdateWishUseCase } from "../../../../src/application/usecases/UpdateWishUseCase";
import { GetWishBySessionUseCase } from "../../../../src/application/usecases/GetWishBySessionUseCase";
import { GetLatestWishesUseCase } from "../../../../src/application/usecases/GetLatestWishesUseCase";
import { GetUserWishUseCase } from "../../../../src/application/usecases/GetUserWishUseCase";
import { SupportWishUseCase } from "../../../../src/application/usecases/SupportWishUseCase";
import { UnsupportWishUseCase } from "../../../../src/application/usecases/UnsupportWishUseCase";
import { GetWishSupportStatusUseCase } from "../../../../src/application/usecases/GetWishSupportStatusUseCase";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

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
  executeWithSupportStatus: jest.fn(),
};

const mockGetUserWishUseCase = {
  execute: jest.fn(),
};

const mockSupportWishUseCase = {
  execute: jest.fn(),
};

const mockUnsupportWishUseCase = {
  execute: jest.fn(),
};

const mockGetWishSupportStatusUseCase = {
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
      mockGetLatestWishesUseCase as unknown as GetLatestWishesUseCase,
      mockGetUserWishUseCase as unknown as GetUserWishUseCase,
      mockSupportWishUseCase as unknown as SupportWishUseCase,
      mockUnsupportWishUseCase as unknown as UnsupportWishUseCase,
      mockGetWishSupportStatusUseCase as unknown as GetWishSupportStatusUseCase
    );
  });

  describe("createWish", () => {
    it("should create a wish successfully", async () => {
      // モックの設定
      const req = mockRequest();
      req.body = { name: "テスト太郎", wish: "テストの願い事" };

      const res = mockResponse();

      const mockWish = Wish.fromRepository({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: SessionId.generate(),
        name: "テスト太郎",
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
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
        undefined,
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

      const mockWish = Wish.fromRepository({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: SessionId.fromString("existing-session-id"),
        name: "テスト太郎",
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
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
        "existing-session-id",
        undefined
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
        "新しい名前",
        "新しい願い事",
        undefined,
        "test-session-id"
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

      const mockWish = Wish.fromRepository({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: SessionId.fromString("test-session-id"),
        name: "テスト太郎",
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
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
        Wish.fromRepository({
          id: WishId.fromString("1"),
          content: WishContent.fromString("願い事1"),
          authorId: SessionId.generate(),
          supportCount: SupportCount.fromNumber(0),
          supporters: new Set<string>(),
          createdAt: new Date(),
        }),
        Wish.fromRepository({
          id: WishId.fromString("2"),
          content: WishContent.fromString("願い事2"),
          authorId: SessionId.generate(),
          supportCount: SupportCount.fromNumber(0),
          supporters: new Set<string>(),
          createdAt: new Date(),
        }),
      ];

      mockGetLatestWishesUseCase.executeWithSupportStatus.mockResolvedValue(
        mockWishes
      );

      // 実行
      await wishController.getLatestWishes(req, res);

      // 検証
      expect(
        mockGetLatestWishesUseCase.executeWithSupportStatus
      ).toHaveBeenCalledWith(10, 20, expect.any(String), undefined);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wishes: mockWishes });
    });

    it("should get latest wishes with sessionId and userId from cookies and user", async () => {
      // モックの設定
      const req = mockRequest();
      req.query = { limit: "5", offset: "10" };
      req.cookies = { sessionId: "test-session-123" };
      req.user = { id: 456 };

      const res = mockResponse();

      const mockWishes = [
        Wish.fromRepository({
          id: WishId.fromString("1"),
          content: WishContent.fromString("願い事1"),
          authorId: SessionId.generate(),
          supportCount: SupportCount.fromNumber(0),
          supporters: new Set<string>(),
          createdAt: new Date(),
          isSupported: true,
        }),
      ];

      mockGetLatestWishesUseCase.executeWithSupportStatus.mockResolvedValue(
        mockWishes
      );

      // 実行
      await wishController.getLatestWishes(req, res);

      // 検証
      expect(
        mockGetLatestWishesUseCase.executeWithSupportStatus
      ).toHaveBeenCalledWith(5, 10, "test-session-123", 456);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wishes: mockWishes });
    });

    it("should handle errors and return 400", async () => {
      // モックの設定
      const req = mockRequest();
      req.query = { limit: "20", offset: "0" };

      const res = mockResponse();

      const error = new Error("Database error");
      mockGetLatestWishesUseCase.executeWithSupportStatus.mockRejectedValue(
        error
      );

      // 実行
      await wishController.getLatestWishes(req, res);

      // 検証
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Database error" });
    });

    it("should handle unknown errors and return generic message", async () => {
      // モックの設定
      const req = mockRequest();
      req.query = {};

      const res = mockResponse();

      // Error以外のオブジェクトを投げる
      mockGetLatestWishesUseCase.executeWithSupportStatus.mockRejectedValue(
        "Unknown error"
      );

      // 実行
      await wishController.getLatestWishes(req, res);

      // 検証
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "不明なエラーが発生しました",
      });
    });
  });

  describe("getUserWish", () => {
    it("should get user wish when user is authenticated", async () => {
      // モックの設定
      const req = mockRequest();
      req.user = { id: 123 };
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();

      const mockWish = Wish.fromRepository({
        id: WishId.fromString("user-wish-id"),
        content: WishContent.fromString("User's wish"),
        authorId: UserId.fromNumber(123),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockGetUserWishUseCase.execute.mockResolvedValue(mockWish);

      // 実行
      await wishController.getUserWish(req, res);

      // 検証
      expect(mockGetUserWishUseCase.execute).toHaveBeenCalledWith(
        123,
        "test-session"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: mockWish });
    });

    it("should get user wish with sessionId only when user is not authenticated", async () => {
      // モックの設定
      const req = mockRequest();
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();

      const mockWish = Wish.fromRepository({
        id: WishId.fromString("session-wish-id"),
        content: WishContent.fromString("Session wish"),
        authorId: SessionId.fromString("test-session"),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockGetUserWishUseCase.execute.mockResolvedValue(mockWish);

      // 実行
      await wishController.getUserWish(req, res);

      // 検證
      expect(mockGetUserWishUseCase.execute).toHaveBeenCalledWith(
        undefined,
        "test-session"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: mockWish });
    });

    it("should return 200 with null wish when no wish is found", async () => {
      // モックの設定
      const req = mockRequest();
      req.user = { id: 123 };
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();

      mockGetUserWishUseCase.execute.mockResolvedValue(null);

      // 実行
      await wishController.getUserWish(req, res);

      // 検証
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: null });
    });

    it("should handle errors in getUserWish", async () => {
      // モックの設定
      const req = mockRequest();
      req.user = { id: 123 };

      const res = mockResponse();

      const error = new Error("Database connection failed");
      mockGetUserWishUseCase.execute.mockRejectedValue(error);

      // 実行
      await wishController.getUserWish(req, res);

      // 検証
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Database connection failed",
      });
    });
  });

  describe("updateWish", () => {
    it("should update wish successfully when user is authenticated", async () => {
      const req = mockRequest();
      req.body = { name: "Updated Name", wish: "Updated wish" };
      req.user = { id: 123 };
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();
      mockUpdateWishUseCase.execute.mockResolvedValue(undefined);

      await wishController.updateWish(req, res);

      expect(mockUpdateWishUseCase.execute).toHaveBeenCalledWith(
        "Updated Name",
        "Updated wish",
        123,
        "test-session"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "更新しました" });
    });

    it("should return 401 when neither userId nor sessionId is provided", async () => {
      const req = mockRequest();
      req.body = { wish: "Test wish" };

      const res = mockResponse();

      await wishController.updateWish(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "編集権限がありません。",
      });
    });

    it("should return 400 when wish is missing", async () => {
      const req = mockRequest();
      req.body = { name: "Test Name" };
      req.user = { id: 123 };

      const res = mockResponse();

      await wishController.updateWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "願い事は必須です。" });
    });

    it("should handle errors in updateWish", async () => {
      const req = mockRequest();
      req.body = { wish: "Test wish" };
      req.user = { id: 123 };

      const res = mockResponse();
      mockUpdateWishUseCase.execute.mockRejectedValue(
        new Error("Update failed")
      );

      await wishController.updateWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Update failed" });
    });
  });

  describe("getCurrentWish", () => {
    it("should get current wish by sessionId", async () => {
      const req = mockRequest();
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();
      const mockWish = Wish.fromRepository({
        id: WishId.fromString("1"),
        content: WishContent.fromString("Test wish"),
        authorId: SessionId.fromString("test-session"),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });
      mockGetWishBySessionUseCase.execute.mockResolvedValue(mockWish);

      await wishController.getCurrentWish(req, res);

      expect(mockGetWishBySessionUseCase.execute).toHaveBeenCalledWith(
        "test-session"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: mockWish });
    });

    it("should return null when no sessionId is provided", async () => {
      const req = mockRequest();
      req.cookies = {};

      const res = mockResponse();

      await wishController.getCurrentWish(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ wish: null });
    });

    it("should handle errors in getCurrentWish", async () => {
      const req = mockRequest();
      req.cookies = { sessionId: "test-session" };

      const res = mockResponse();
      mockGetWishBySessionUseCase.execute.mockRejectedValue(
        new Error("Session error")
      );

      await wishController.getCurrentWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Session error" });
    });
  });

  describe("supportWish", () => {
    it("should support a wish successfully", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };
      req.cookies = { sessionId: "session123" };
      req.user = { id: 456 };

      const res = mockResponse();
      mockSupportWishUseCase.execute.mockResolvedValue({
        alreadySupported: false,
      });

      await wishController.supportWish(req, res);

      expect(mockSupportWishUseCase.execute).toHaveBeenCalledWith(
        "wish123",
        "session123",
        456
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "応援しました",
        success: true,
        alreadySupported: false,
      });
    });

    it("should handle already supported wish", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };
      req.cookies = { sessionId: "session123" };

      const res = mockResponse();
      mockSupportWishUseCase.execute.mockResolvedValue({
        alreadySupported: true,
      });

      await wishController.supportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "既に応援済みです",
        success: true,
        alreadySupported: true,
      });
    });

    it("should return 400 when wishId is missing", async () => {
      const req = mockRequest();
      req.params = {};

      const res = mockResponse();

      await wishController.supportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "願い事IDが必要です" });
    });

    it("should handle errors in supportWish", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };

      const res = mockResponse();
      mockSupportWishUseCase.execute.mockRejectedValue(
        new Error("Support failed")
      );

      await wishController.supportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Support failed" });
    });
  });

  describe("unsupportWish", () => {
    it("should unsupport a wish successfully", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };
      req.cookies = { sessionId: "session123" };
      req.user = { id: 456 };

      const res = mockResponse();
      mockUnsupportWishUseCase.execute.mockResolvedValue({
        wasSupported: true,
      });

      await wishController.unsupportWish(req, res);

      expect(mockUnsupportWishUseCase.execute).toHaveBeenCalledWith(
        "wish123",
        "session123",
        456
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "応援を取り消しました",
        success: true,
        wasSupported: true,
      });
    });

    it("should handle wish that was not supported", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };
      req.cookies = { sessionId: "session123" };

      const res = mockResponse();
      mockUnsupportWishUseCase.execute.mockResolvedValue({
        wasSupported: false,
      });

      await wishController.unsupportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "応援していませんでした",
        success: true,
        wasSupported: false,
      });
    });

    it("should return 400 when wishId is missing in unsupportWish", async () => {
      const req = mockRequest();
      req.params = {};

      const res = mockResponse();

      await wishController.unsupportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "願い事IDが必要です" });
    });

    it("should handle errors in unsupportWish", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };

      const res = mockResponse();
      mockUnsupportWishUseCase.execute.mockRejectedValue(
        new Error("Unsupport failed")
      );

      await wishController.unsupportWish(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Unsupport failed" });
    });
  });

  describe("getWishSupportStatus", () => {
    it("should get wish support status successfully", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };
      req.cookies = { sessionId: "session123" };
      req.user = { id: 456 };

      const res = mockResponse();
      const mockWish = Wish.fromRepository({
        id: WishId.fromString("wish123"),
        content: WishContent.fromString("Test wish"),
        authorId: SessionId.generate(),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });
      const mockResult = { isSupported: true, wish: mockWish };
      mockGetWishSupportStatusUseCase.execute.mockResolvedValue(mockResult);

      await wishController.getWishSupportStatus(req, res);

      expect(mockGetWishSupportStatusUseCase.execute).toHaveBeenCalledWith(
        "wish123",
        "session123",
        456
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        isSupported: true,
        wish: mockWish,
      });
    });

    it("should return 400 when wishId is missing in getWishSupportStatus", async () => {
      const req = mockRequest();
      req.params = {};

      const res = mockResponse();

      await wishController.getWishSupportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "願い事IDが必要です" });
    });

    it("should handle errors in getWishSupportStatus", async () => {
      const req = mockRequest();
      req.params = { wishId: "wish123" };

      const res = mockResponse();
      mockGetWishSupportStatusUseCase.execute.mockRejectedValue(
        new Error("Status check failed")
      );

      await wishController.getWishSupportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Status check failed" });
    });
  });
});
