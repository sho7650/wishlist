import { KoaWishAdapter } from "../../../../src/adapters/primary/KoaWishAdapter";
import { Wish } from "../../../../src/domain/entities/Wish";
import Koa from "koa";

// Koaのモック - 最小限の必要なプロパティのみ
const mockContext = {
  request: {
    body: {},
  },
  query: {},
  params: {},
  cookies: {
    get: jest.fn(),
    set: jest.fn(),
  },
  state: {
    user: undefined,
  },
  body: undefined,
  status: 200,
  throw: jest.fn(),
} as unknown as Koa.Context;

// UseCaseのモック
const mockCreateWishUseCase = {
  execute: jest.fn(),
} as any;

const mockUpdateWishUseCase = {
  execute: jest.fn(),
} as any;

const mockGetWishBySessionUseCase = {
  execute: jest.fn(),
} as any;

const mockGetLatestWishesUseCase = {
  execute: jest.fn(),
  executeWithSupportStatus: jest.fn(),
} as any;

const mockGetUserWishUseCase = {
  execute: jest.fn(),
} as any;

const mockSupportWishUseCase = {
  execute: jest.fn(),
} as any;

const mockUnsupportWishUseCase = {
  execute: jest.fn(),
} as any;

const mockGetWishSupportStatusUseCase = {
  execute: jest.fn(),
} as any;

describe("KoaWishAdapter", () => {
  let koaWishAdapter: KoaWishAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockContext as any).request.body = {};
    (mockContext as any).query = {};
    (mockContext as any).params = {};
    (mockContext as any).cookies.get.mockReturnValue(undefined);
    (mockContext as any).cookies.set.mockReturnValue(undefined);
    (mockContext as any).state.user = undefined;
    (mockContext as any).body = undefined;
    (mockContext as any).status = 200;

    koaWishAdapter = new KoaWishAdapter(
      mockCreateWishUseCase,
      mockUpdateWishUseCase,
      mockGetWishBySessionUseCase,
      mockGetLatestWishesUseCase,
      mockGetUserWishUseCase,
      mockSupportWishUseCase,
      mockUnsupportWishUseCase,
      mockGetWishSupportStatusUseCase
    );
  });

  describe("createWish", () => {
    it("should create a wish successfully", async () => {
      (mockContext as any).request.body = { name: "Test User", wish: "Test wish" };
      (mockContext as any).cookies.get.mockReturnValue("test-session");
      (mockContext as any).state.user = { id: 123 };

      const mockWish = new Wish({ id: "1", wish: "Test wish", createdAt: new Date() });
      mockCreateWishUseCase.execute.mockResolvedValue({
        wish: mockWish,
        sessionId: "test-session"
      });

      await koaWishAdapter.createWish(mockContext);

      expect(mockCreateWishUseCase.execute).toHaveBeenCalledWith(
        "Test User",
        "Test wish",
        "test-session",
        123
      );
      expect((mockContext as any).status).toBe(201);
      expect((mockContext as any).body).toEqual({ wish: mockWish });
      expect((mockContext as any).cookies.set).toHaveBeenCalledWith("sessionId", "test-session", {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        sameSite: "strict",
      });
    });

    it("should return 400 when wish is missing", async () => {
      (mockContext as any).request.body = { name: "Test User" };

      await koaWishAdapter.createWish(mockContext);

      expect(mockCreateWishUseCase.execute).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      (mockContext as any).request.body = { wish: "Test wish" };
      mockCreateWishUseCase.execute.mockRejectedValue(new Error("Create failed"));

      await koaWishAdapter.createWish(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "Create failed" });
    });

    it("should handle unknown errors", async () => {
      (mockContext as any).request.body = { wish: "Test wish" };
      mockCreateWishUseCase.execute.mockRejectedValue("Unknown error");

      await koaWishAdapter.createWish(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "不明なエラーが発生しました" });
    });
  });

  describe("updateWish", () => {
    it("should update wish successfully", async () => {
      (mockContext as any).request.body = { name: "Updated Name", wish: "Updated wish" };
      (mockContext as any).state.user = { id: 123 };
      (mockContext as any).cookies.get.mockReturnValue("test-session");

      mockUpdateWishUseCase.execute.mockResolvedValue(undefined);

      await koaWishAdapter.updateWish(mockContext);

      expect(mockUpdateWishUseCase.execute).toHaveBeenCalledWith(
        "Updated Name",
        "Updated wish",
        123,
        "test-session"
      );
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ message: "更新しました" });
    });

    it("should return 401 when neither userId nor sessionId is provided", async () => {
      (mockContext as any).request.body = { wish: "Test wish" };

      await koaWishAdapter.updateWish(mockContext);

      expect((mockContext as any).status).toBe(401);
      expect((mockContext as any).body).toEqual({ error: "編集権限がありません" });
    });

    it("should return 400 when wish is missing", async () => {
      (mockContext as any).request.body = { name: "Test Name" };
      (mockContext as any).state.user = { id: 123 };

      await koaWishAdapter.updateWish(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "願い事は必須です" });
    });
  });

  describe("getCurrentWish", () => {
    it("should get current wish by sessionId", async () => {
      (mockContext as any).cookies.get.mockReturnValue("test-session");
      const mockWish = new Wish({ id: "1", wish: "Test wish", createdAt: new Date() });
      mockGetWishBySessionUseCase.execute.mockResolvedValue(mockWish);

      await koaWishAdapter.getCurrentWish(mockContext);

      expect(mockGetWishBySessionUseCase.execute).toHaveBeenCalledWith("test-session");
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ wish: mockWish });
    });

    it("should return null when no sessionId is provided", async () => {
      (mockContext as any).cookies.get.mockReturnValue(undefined);

      await koaWishAdapter.getCurrentWish(mockContext);

      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ wish: null });
    });
  });

  describe("getLatestWishes", () => {
    it("should get latest wishes with support status", async () => {
      (mockContext as any).query = { limit: "10", offset: "20" };
      (mockContext as any).cookies.get.mockReturnValue("test-session");
      (mockContext as any).state.user = { id: 123 };
      
      const mockWishes = [
        new Wish({ id: "1", wish: "Test wish 1", createdAt: new Date(), isSupported: true }),
        new Wish({ id: "2", wish: "Test wish 2", createdAt: new Date(), isSupported: false }),
      ];
      mockGetLatestWishesUseCase.executeWithSupportStatus.mockResolvedValue(mockWishes);

      await koaWishAdapter.getLatestWishes(mockContext);

      expect(mockGetLatestWishesUseCase.executeWithSupportStatus).toHaveBeenCalledWith(10, 20, "test-session", 123);
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ wishes: mockWishes });
    });

    it("should use default values for limit and offset", async () => {
      (mockContext as any).query = {};
      (mockContext as any).cookies.get.mockReturnValue("test-session");
      mockGetLatestWishesUseCase.executeWithSupportStatus.mockResolvedValue([]);

      await koaWishAdapter.getLatestWishes(mockContext);

      expect(mockGetLatestWishesUseCase.executeWithSupportStatus).toHaveBeenCalledWith(20, 0, "test-session", undefined);
    });

    it("should generate session ID for anonymous users", async () => {
      (mockContext as any).query = {};
      (mockContext as any).cookies.get.mockReturnValue(undefined); // No existing session
      (mockContext as any).state.user = undefined; // Anonymous user
      mockGetLatestWishesUseCase.executeWithSupportStatus.mockResolvedValue([]);

      await koaWishAdapter.getLatestWishes(mockContext);

      expect((mockContext as any).cookies.set).toHaveBeenCalledWith(
        "sessionId", 
        expect.any(String), 
        {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          sameSite: "strict",
          secure: false,
        }
      );
    });
  });

  describe("getUserWish", () => {
    it("should get user wish successfully", async () => {
      (mockContext as any).state.user = { id: 123 };
      (mockContext as any).cookies.get.mockReturnValue("test-session");

      const mockWish = new Wish({ id: "1", wish: "User wish", createdAt: new Date() });
      mockGetUserWishUseCase.execute.mockResolvedValue(mockWish);

      await koaWishAdapter.getUserWish(mockContext);

      expect(mockGetUserWishUseCase.execute).toHaveBeenCalledWith(123, "test-session");
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ wish: mockWish });
    });

    it("should return wish as null when no wish is found", async () => {
      (mockContext as any).state.user = { id: 123 };
      mockGetUserWishUseCase.execute.mockResolvedValue(null);

      await koaWishAdapter.getUserWish(mockContext);

      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ wish: null });
    });
  });

  describe("supportWish", () => {
    it("should support a wish successfully", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue("session123");
      (mockContext as any).state.user = { id: 456 };

      mockSupportWishUseCase.execute.mockResolvedValue({ alreadySupported: false });

      await koaWishAdapter.supportWish(mockContext);

      expect(mockSupportWishUseCase.execute).toHaveBeenCalledWith("wish123", "session123", 456);
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({
        message: "応援しました",
        success: true,
        alreadySupported: false
      });
    });

    it("should handle already supported wish", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue("session123");
      mockSupportWishUseCase.execute.mockResolvedValue({ alreadySupported: true });

      await koaWishAdapter.supportWish(mockContext);

      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({ 
        message: "既に応援済みです", 
        success: true, 
        alreadySupported: true 
      });
    });

    it("should generate session ID for anonymous users", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue(undefined); // No existing session
      (mockContext as any).state.user = undefined; // Anonymous user
      mockSupportWishUseCase.execute.mockResolvedValue({ alreadySupported: false });

      await koaWishAdapter.supportWish(mockContext);

      expect((mockContext as any).cookies.set).toHaveBeenCalledWith(
        "sessionId", 
        expect.any(String), 
        {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          sameSite: "strict",
          secure: false,
        }
      );
    });

    it("should return 400 when wishId is missing", async () => {
      (mockContext as any).params = {};

      await koaWishAdapter.supportWish(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "願い事IDが必要です" });
    });
  });

  describe("unsupportWish", () => {
    it("should unsupport a wish successfully", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue("session123");
      (mockContext as any).state.user = { id: 456 };

      mockUnsupportWishUseCase.execute.mockResolvedValue({ wasSupported: true });

      await koaWishAdapter.unsupportWish(mockContext);

      expect(mockUnsupportWishUseCase.execute).toHaveBeenCalledWith("wish123", "session123", 456);
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({
        message: "応援を取り消しました",
        success: true
      });
    });

    it("should handle wish that was not supported", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue("session123");
      mockUnsupportWishUseCase.execute.mockResolvedValue({ wasSupported: false });

      await koaWishAdapter.unsupportWish(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "応援していません" });
    });

    it("should generate session ID for anonymous users", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue(undefined); // No existing session
      (mockContext as any).state.user = undefined; // Anonymous user
      mockUnsupportWishUseCase.execute.mockResolvedValue({ wasSupported: true });

      await koaWishAdapter.unsupportWish(mockContext);

      expect((mockContext as any).cookies.set).toHaveBeenCalledWith(
        "sessionId", 
        expect.any(String), 
        {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          sameSite: "strict",
          secure: false,
        }
      );
    });
  });

  describe("getWishSupportStatus", () => {
    it("should get wish support status successfully", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue("session123");
      (mockContext as any).state.user = { id: 456 };

      const mockWish = new Wish({ id: "wish123", wish: "Test wish", createdAt: new Date() });
      const mockResult = { isSupported: true, wish: mockWish };
      mockGetWishSupportStatusUseCase.execute.mockResolvedValue(mockResult);

      await koaWishAdapter.getWishSupportStatus(mockContext);

      expect(mockGetWishSupportStatusUseCase.execute).toHaveBeenCalledWith("wish123", "session123", 456);
      expect((mockContext as any).status).toBe(200);
      expect((mockContext as any).body).toEqual({
        isSupported: true,
        wish: mockWish
      });
    });

    it("should generate session ID for anonymous users", async () => {
      (mockContext as any).params = { wishId: "wish123" };
      (mockContext as any).cookies.get.mockReturnValue(undefined); // No existing session
      (mockContext as any).state.user = undefined; // Anonymous user

      const mockWish = new Wish({ id: "wish123", wish: "Test wish", createdAt: new Date() });
      const mockResult = { isSupported: false, wish: mockWish };
      mockGetWishSupportStatusUseCase.execute.mockResolvedValue(mockResult);

      await koaWishAdapter.getWishSupportStatus(mockContext);

      expect((mockContext as any).cookies.set).toHaveBeenCalledWith(
        "sessionId", 
        expect.any(String), 
        {
          httpOnly: true,
          maxAge: 365 * 24 * 60 * 60 * 1000,
          sameSite: "strict",
          secure: false,
        }
      );
    });

    it("should return 400 when wishId is missing", async () => {
      (mockContext as any).params = {};

      await koaWishAdapter.getWishSupportStatus(mockContext);

      expect((mockContext as any).status).toBe(400);
      expect((mockContext as any).body).toEqual({ error: "願い事IDが必要です" });
    });
  });
});