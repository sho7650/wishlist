import { KoaServer } from "../../../../src/infrastructure/web/KoaServer";
import { KoaWishAdapter } from "../../../../src/adapters/primary/KoaWishAdapter";

// --- モックの設定 ---
// Koaのモック
const mockApp = {
  use: jest.fn().mockReturnThis(),
  listen: jest.fn((port, callback) => {
    if (callback) callback();
    return { close: jest.fn() };
  }),
  keys: [],
};

// Koaルーターのモック
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  routes: jest.fn(() => "router-routes"),
  allowedMethods: jest.fn(() => "router-allowed-methods"),
};

// Koaのモック設定
jest.mock("koa", () => {
  return jest.fn(() => mockApp);
});

jest.mock("@koa/router", () => {
  return jest.fn(() => mockRouter);
});

// 依存モジュールのモック
jest.mock("koa-bodyparser", () => jest.fn(() => "bodyParser middleware"));
jest.mock("koa-static", () => jest.fn(() => "static middleware"));
jest.mock("koa-helmet", () => ({
  contentSecurityPolicy: jest.fn(() => "csp middleware"),
}));
jest.mock("koa-session", () => jest.fn(() => "session middleware"));

// パスポート設定のモック
jest.mock("../../../../src/config/koa-passport", () => ({
  koaPassport: {
    initialize: jest.fn(() => "passport-initialize"),
    session: jest.fn(() => "passport-session"),
    authenticate: jest.fn(() => "passport-authenticate"),
  },
  configureKoaPassport: jest.fn(),
}));

// ファイルシステムのモック
jest.mock("fs", () => ({
  createReadStream: jest.fn(() => "file-stream"),
}));

// KoaWishAdapterのモック
class MockKoaWishAdapter extends KoaWishAdapter {
  constructor() {
    // superにはダミーのモックを渡す
    super({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    // メソッドをjestのモック関数で上書き
    this.createWish = jest.fn();
    this.updateWish = jest.fn();
    this.getCurrentWish = jest.fn();
    this.getLatestWishes = jest.fn();
    this.getUserWish = jest.fn();
    this.supportWish = jest.fn();
    this.unsupportWish = jest.fn();
    this.getWishSupportStatus = jest.fn();
  }
}

describe("KoaServer", () => {
  let server: KoaServer;
  let mockKoaWishAdapter: KoaWishAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockKoaWishAdapter = new MockKoaWishAdapter();
    const mockDbConnection = {}; // Add a mock dbConnection object
    server = new KoaServer(mockDbConnection, mockKoaWishAdapter);
  });

  it("should setup all required middleware", () => {
    const helmet = require("koa-helmet");
    const session = require("koa-session");
    const bodyParser = require("koa-bodyparser");
    const serve = require("koa-static");

    // 期待されるミドルウェアがすべてuseで登録されているか検証
    expect(mockApp.use).toHaveBeenCalledWith(helmet.contentSecurityPolicy());
    expect(mockApp.use).toHaveBeenCalledWith("session middleware");
    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // passport-initialize
    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // passport-session
    expect(mockApp.use).toHaveBeenCalledWith("bodyParser middleware");
    expect(mockApp.use).toHaveBeenCalledWith("static middleware");
  });

  it("should setup all required routes", () => {
    const { koaPassport } = require("../../../../src/config/koa-passport");

    // 認証ルート
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/auth/google",
      expect.any(Function) // passport-authenticate
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/auth/google/callback",
      expect.any(Function) // passport-authenticate
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/auth/logout",
      expect.any(Function)
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/api/user",
      expect.any(Function)
    );

    // API ルート
    expect(mockRouter.post).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function), // ensureAuth middleware
      mockKoaWishAdapter.createWish
    );
    expect(mockRouter.put).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function), // ensureAuth middleware
      mockKoaWishAdapter.updateWish
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/api/wishes/current",
      mockKoaWishAdapter.getCurrentWish
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/api/wishes",
      mockKoaWishAdapter.getLatestWishes
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/api/user/wish",
      mockKoaWishAdapter.getUserWish
    );

    // 応援機能のルート
    expect(mockRouter.post).toHaveBeenCalledWith(
      "/api/wishes/:wishId/support",
      mockKoaWishAdapter.supportWish
    );
    expect(mockRouter.delete).toHaveBeenCalledWith(
      "/api/wishes/:wishId/support",
      mockKoaWishAdapter.unsupportWish
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      "/api/wishes/:wishId/support",
      mockKoaWishAdapter.getWishSupportStatus
    );
  });

  it("should setup router middleware", () => {
    // ルーターミドルウェアが正しく設定されているか検証
    expect(mockApp.use).toHaveBeenCalledWith("router-routes");
    expect(mockApp.use).toHaveBeenCalledWith("router-allowed-methods");
  });

  it("should setup SPA fallback middleware", () => {
    // SPAフォールバック用のミドルウェアが設定されているか確認
    const middlewareCalls = mockApp.use.mock.calls;
    const spaFallbackCall = middlewareCalls.find(
      (call) => typeof call[0] === "function" && call[0].constructor.name === "AsyncFunction"
    );
    expect(spaFallbackCall).toBeDefined();
  });

  it("should serve static files from the public directory", () => {
    const serve = require("koa-static");
    // koa-staticが正しいパスで呼ばれているか検証
    expect(mockApp.use).toHaveBeenCalledWith("static middleware");
    expect(serve).toHaveBeenCalledWith(expect.stringContaining("public"));
  });

  it("should start the server on the specified port", () => {
    const port = 3000;
    server.start(port);
    // listenが正しいポートで呼ばれたか検証
    expect(mockApp.listen).toHaveBeenCalledWith(port, expect.any(Function));
  });

  it("should configure session keys", () => {
    // セッションキーが設定されているか確認
    expect(mockApp.keys).toBeDefined();
    expect(Array.isArray(mockApp.keys)).toBe(true);
  });

  it("should call configureKoaPassport with dbConnection", () => {
    const { configureKoaPassport } = require("../../../../src/config/koa-passport");
    expect(configureKoaPassport).toHaveBeenCalledWith({});
  });
});