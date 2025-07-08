import { Server } from "../../../../src/infrastructure/web/Server";
import { WishController } from "../../../../src/adapters/primary/WishController";
// expressのインポートは型のヒントのために残しておきます
import express from "express";

// --- ここからが修正のポイント ---

// 1. テスト全体で共有するモックアプリのインスタンスを作成します。
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  listen: jest.fn((port, callback) => {
    // listenのコールバックを呼び出すようにして、より現実的な動作を模倣します。
    if (callback) callback();
    return { close: jest.fn() }; // listenはサーバーインスタンスを返すため、それもモックします。
  }),
};

// 2. expressモジュールをモックします。
//    express()が呼ばれたら、常に上で定義した mockApp を返すようにします。
jest.mock("express", () => {
  const actualExpress = jest.fn(() => mockApp);
  // express.json() や express.static() のような静的メソッドもモックします。
  (actualExpress as any).json = jest.fn(() => "json middleware");
  (actualExpress as any).static = jest.fn(() => "static middleware");
  return actualExpress;
});

// --- ここまでが修正のポイント ---

// コントローラーをモック - WishControllerクラスを継承したモックを作成
class MockWishController extends WishController {
  constructor() {
    super(
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any,
      { execute: jest.fn() } as any
    );

    // メソッドをスパイでオーバーライド
    this.createWish = jest.fn();
    this.updateWish = jest.fn();
    this.getCurrentWish = jest.fn();
    this.getLatestWishes = jest.fn();
  }
}

describe("Server", () => {
  let server: Server;
  let mockWishController: WishController;

  beforeEach(() => {
    // 3. 各テストの前に、すべてのモック（mockAppのメソッドも含む）をクリアします。
    jest.clearAllMocks();

    mockWishController = new MockWishController();
    // 4. Serverをインスタンス化します。これにより内部で mockApp が使用されます。
    server = new Server(mockWishController);
  });

  it("should setup middleware correctly", () => {
    // 5. テストケース内では新しいアプリを作らず、共有の mockApp を検証します。
    expect(mockApp.use).toHaveBeenCalledWith("json middleware");
    expect(mockApp.use).toHaveBeenCalledWith("static middleware");
    // cookieParser の分も合わせて use が呼ばれていることを確認
    // 修正: helmetとrate-limitも追加されている場合、呼び出し回数は増えます。
    // 今は具体的な回数よりも、呼ばれた内容を重視します。
    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function)); // cookieParser
  });

  it("should setup routes correctly", () => {
    expect(mockApp.post).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function)
    );
    expect(mockApp.put).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function)
    );
    expect(mockApp.get).toHaveBeenCalledWith(
      "/api/wishes/current",
      expect.any(Function)
    );
    expect(mockApp.get).toHaveBeenCalledWith(
      "/api/wishes",
      expect.any(Function)
    );
    expect(mockApp.get).toHaveBeenCalledWith(/.*/, expect.any(Function));
  });

  it("should start server on specified port", () => {
    const port = 3000;
    server.start(port);

    expect(mockApp.listen).toHaveBeenCalledWith(port, expect.any(Function));
  });

  it("should use default port when none specified", () => {
    server.start();

    // server.tsのstartメソッドではprocess.env.PORTを優先するため、テスト実行時に未定義であることを確認
    const expectedPort = parseInt(process.env.PORT || "3000");
    expect(mockApp.listen).toHaveBeenCalledWith(
      expectedPort,
      expect.any(Function)
    );
  });

  it("should use PORT environment variable when available", () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, PORT: "4000" };

    // Serverのインスタンスを再作成して新しい環境変数を反映させる
    server = new Server(mockWishController);
    server.start();

    expect(mockApp.listen).toHaveBeenCalledWith(4000, expect.any(Function));

    process.env = originalEnv;
  });
});
