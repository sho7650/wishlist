import { KoaServer } from "../../../../src/infrastructure/web/KoaServer";
import { KoaWishAdapter } from "../../../../src/adapters/primary/KoaWishAdapter";

// --- モックの設定 ---
// Koaのモック
const mockKoaInstance = {
  use: jest.fn().mockReturnThis(), // メソッドチェーンのためにthisを返す
  listen: jest.fn((port, callback) => {
    if (callback) callback();
    return { close: jest.fn() };
  }),
};
jest.mock("koa", () => {
  return jest.fn().mockImplementation(() => mockKoaInstance);
});

// @koa/routerのモック
const mockRouterInstance = {
  post: jest.fn(),
  put: jest.fn(),
  get: jest.fn(),
  routes: jest.fn(() => "routes middleware"),
  allowedMethods: jest.fn(() => "allowedMethods middleware"),
};
jest.mock("@koa/router", () => {
  return jest.fn().mockImplementation(() => mockRouterInstance);
});

// その他のミドルウェアのモック
jest.mock("koa-bodyparser", () => jest.fn(() => "bodyParser middleware"));
jest.mock("koa-static", () => jest.fn(() => "static middleware"));
jest.mock("koa-helmet", () => jest.fn(() => "helmet middleware"));

// アダプターのモック
class MockKoaWishAdapter extends KoaWishAdapter {
  constructor() {
    super({} as any, {} as any, {} as any, {} as any);
    this.createWish = jest.fn();
    this.updateWish = jest.fn();
    this.getCurrentWish = jest.fn();
    this.getLatestWishes = jest.fn();
  }
}

// --- テストスイート ---
describe("KoaServer", () => {
  let server: KoaServer;
  let mockKoaWishAdapter: KoaWishAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockKoaWishAdapter = new MockKoaWishAdapter();
    server = new KoaServer(mockKoaWishAdapter);
  });

  it("should setup all required middleware", () => {
    // 期待されるミドルウェアがすべてuseで登録されているか検証
    expect(mockKoaInstance.use).toHaveBeenCalledWith("helmet middleware");
    expect(mockKoaInstance.use).toHaveBeenCalledWith("bodyParser middleware");
    expect(mockKoaInstance.use).toHaveBeenCalledWith("static middleware");
    // ルーターとSPAフォールバック用のミドルウェア
    expect(mockKoaInstance.use).toHaveBeenCalledWith("routes middleware");
    expect(mockKoaInstance.use).toHaveBeenCalledWith(
      "allowedMethods middleware"
    );
    expect(mockKoaInstance.use).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should setup all required routes", () => {
    // 期待されるルートがすべて正しいメソッドとハンドラで登録されているか検証
    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      "/api/wishes",
      mockKoaWishAdapter.createWish
    );
    expect(mockRouterInstance.put).toHaveBeenCalledWith(
      "/api/wishes",
      mockKoaWishAdapter.updateWish
    );
    expect(mockRouterInstance.get).toHaveBeenCalledWith(
      "/api/wishes/current",
      mockKoaWishAdapter.getCurrentWish
    );
    expect(mockRouterInstance.get).toHaveBeenCalledWith(
      "/api/wishes",
      mockKoaWishAdapter.getLatestWishes
    );
  });

  it("should start the server on the specified port", () => {
    const port = 5000;
    server.start(port);
    // listenが正しいポートで呼ばれたか検証
    expect(mockKoaInstance.listen).toHaveBeenCalledWith(
      port,
      expect.any(Function)
    );
  });
});
