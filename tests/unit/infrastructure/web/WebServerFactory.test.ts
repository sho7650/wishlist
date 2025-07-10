import { WebServerFactory } from "../../../../src/infrastructure/web/WebServerFactory";
import { ExpressServer } from "../../../../src/infrastructure/web/ExpressServer";
import { KoaServer } from "../../../../src/infrastructure/web/KoaServer";

// 実際の依存関係をモック
jest.mock("../../../../src/infrastructure/web/ExpressServer");
jest.mock("../../../../src/infrastructure/web/KoaServer");
jest.mock("../../../../src/adapters/primary/WishController");
jest.mock("../../../../src/adapters/primary/KoaWishAdapter");

describe("WebServerFactory", () => {
  const mockDbConnection = {} as any;
  const mockWishRepository = {} as any;
  const mockSessionService = {} as any;
  const originalEnv = process.env;

  beforeEach(() => {
    // 各テストの前にモックと環境変数をリセット
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // 全テスト終了後に環境変数を元に戻す
    process.env = originalEnv;
  });

  it('should create an ExpressServer when WEB_FRAMEWORK is "express"', () => {
    process.env.WEB_FRAMEWORK = "express";
    WebServerFactory.createServer(
      mockDbConnection,
      mockWishRepository,
      mockSessionService
    );
    expect(ExpressServer).toHaveBeenCalledTimes(1);
    expect(KoaServer).not.toHaveBeenCalled();
  });

  it('should create a KoaServer when WEB_FRAMEWORK is "koa"', () => {
    process.env.WEB_FRAMEWORK = "koa";
    WebServerFactory.createServer(
      mockDbConnection,
      mockWishRepository,
      mockSessionService
    );
    expect(KoaServer).toHaveBeenCalledTimes(1);
    expect(ExpressServer).not.toHaveBeenCalled();
  });

  it("should create an ExpressServer as default when WEB_FRAMEWORK is not set", () => {
    delete process.env.WEB_FRAMEWORK;
    WebServerFactory.createServer(
      mockDbConnection,
      mockWishRepository,
      mockSessionService
    );
    expect(ExpressServer).toHaveBeenCalledTimes(1);
    expect(KoaServer).not.toHaveBeenCalled();
  });

  it("should throw an error for unsupported WEB_FRAMEWORK", () => {
    process.env.WEB_FRAMEWORK = "unsupported";
    expect(() => {
      WebServerFactory.createServer(
        mockDbConnection,
        mockWishRepository,
        mockSessionService
      );
    }).toThrow("Unsupported web framework: unsupported");
  });
});
