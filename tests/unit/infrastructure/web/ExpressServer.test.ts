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
  (actualExpress as any).static = jest.fn(() => "static middleware");
  return actualExpress;
});

// 依存する他のモジュールもモック化
jest.mock("cookie-parser", () => jest.fn(() => "cookieParser middleware"));
jest.mock("helmet", () => jest.fn(() => "helmet middleware"));

// Controllerのモック
class MockWishController extends WishController {
  constructor() {
    // superにはダミーのモックを渡す
    super({} as any, {} as any, {} as any, {} as any);
    // メソッドをjestのモック関数で上書き
    this.createWish = jest.fn();
    this.updateWish = jest.fn();
    this.getCurrentWish = jest.fn();
    this.getLatestWishes = jest.fn();
  }
}

// --- テストスイート ---
describe("ExpressServer", () => {
  let server: ExpressServer;
  let mockWishController: WishController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWishController = new MockWishController();
    server = new ExpressServer(mockWishController);
  });

  it("should setup all required middleware", () => {
    // 期待されるミドルウェアがすべてuseで登録されているか検証
    expect(mockApp.use).toHaveBeenCalledWith("helmet middleware");
    expect(mockApp.use).toHaveBeenCalledWith("json middleware");
    expect(mockApp.use).toHaveBeenCalledWith("static middleware");
    expect(mockApp.use).toHaveBeenCalledWith("cookieParser middleware");
  });

  it("should setup all required routes", () => {
    // 期待されるルートがすべて正しいメソッドとハンドラで登録されているか検証
    expect(mockApp.post).toHaveBeenCalledWith(
      "/api/wishes",
      mockWishController.createWish
    );
    expect(mockApp.put).toHaveBeenCalledWith(
      "/api/wishes",
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

  it("should start the server on the specified port", () => {
    const port = 3000;
    server.start(port);
    // listenが正しいポートで呼ばれたか検証
    expect(mockApp.listen).toHaveBeenCalledWith(port, expect.any(Function));
  });
});
