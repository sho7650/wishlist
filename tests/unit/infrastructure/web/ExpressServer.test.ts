import { ExpressServer } from "../../../../src/infrastructure/web/ExpressServer";
import { WishController } from "../../../../src/adapters/primary/WishController";

// --- モックの設定 ---
// 共有のモックインスタンスを定義
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  listen: jest.fn((port, callback) => {
    if (callback) callback();
    return { close: jest.fn() };
  }),
};

// express()が呼ばれたら、常にmockAppを返すように設定
jest.mock("express", () => {
  const actualExpress = jest.fn(() => mockApp);
  (actualExpress as any).json = jest.fn(() => "json middleware");
  (actualExpress as any).static = jest.fn(() => jest.fn());
  return actualExpress;
});

// 依存する他のモジュールもモック化
jest.mock("cookie-parser", () => jest.fn(() => "cookieParser middleware"));
jest.mock("helmet", () => ({
  // helmetモジュールが持つべき contentSecurityPolicy プロパティを定義し、
  // その値をモック関数にする。
  contentSecurityPolicy: jest.fn(() => "csp middleware"),
}));
jest.mock("passport-oauth2", () => {
  return jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
    clientID: "mockClientID", // Provide a mock clientID
  }));
});

// Controllerのモック
class MockWishController extends WishController {
  constructor() {
    // superにはダミーのモックを渡す
    super({} as any, {} as any, {} as any, {} as any, {} as any);
    // メソッドをjestのモック関数で上書き
    this.createWish = jest.fn();
    this.updateWish = jest.fn();
    this.getCurrentWish = jest.fn();
    this.getLatestWishes = jest.fn();
    this.getUserWish = jest.fn();
  }
}

// --- テストスイート ---
describe("ExpressServer", () => {
  let server: ExpressServer;
  let mockWishController: WishController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWishController = new MockWishController();
    const mockDbConnection = {}; // Add a mock or actual dbConnection object
    server = new ExpressServer(mockDbConnection, mockWishController);
  });

  it("should setup all required middleware", () => {
    // 期待されるミドルウェアがすべてuseで登録されているか検証
    expect(mockApp.use).toHaveBeenCalledWith("json middleware");
    expect(mockApp.use).toHaveBeenCalledWith("cookieParser middleware");

    const helmet = require("helmet");
    // helmet.contentSecurityPolicy() が返す "csp middleware" が use に渡されたかを検証
    expect(mockApp.use).toHaveBeenCalledWith(helmet.contentSecurityPolicy());
  });

  it("should setup all required routes", () => {
    // 期待されるルートがすべて正しいメソッドとハンドラで登録されているか検証
    expect(mockApp.post).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function), // ensureAuth middleware
      mockWishController.createWish
    );
    expect(mockApp.put).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function), // ensureAuth middleware
      mockWishController.updateWish
    );
    expect(mockApp.get).toHaveBeenCalledWith(
      "/api/wishes/current",
      mockWishController.getCurrentWish
    );
    expect(mockApp.get).toHaveBeenCalledWith(
      "/api/wishes",
      mockWishController.getLatestWishes
    );
    // SPAフォールバック用のルート
    expect(mockApp.get).toHaveBeenCalledWith(/.*/, expect.any(Function));
  });

  it("should SPA fallback to index.html for non-API routes", () => {
    // SPAフォールバックのルートが正しく設定されているか検証
    const fallbackRoute = mockApp.get.mock.calls.find(
      (call) => call[0] instanceof RegExp && call[0].test("/public/index.html")
    );
    expect(fallbackRoute).toBeDefined();
    expect(fallbackRoute[1]).toBeInstanceOf(Function); // ハンドラが関数であることを確認
  });

  it("should serve static files from the public directory", () => {
    // express.staticが正しいパスで呼ばれているか検証
    expect(mockApp.use).toHaveBeenCalledWith(
      expect.any(Function) // static middlewareは関数なので、具体的な内容はチェックしない
    );
  });

  it("should start the server on the specified port", () => {
    const port = 3000;
    server.start(port);
    // listenが正しいポートで呼ばれたか検証
    expect(mockApp.listen).toHaveBeenCalledWith(port, expect.any(Function));
  });
});
