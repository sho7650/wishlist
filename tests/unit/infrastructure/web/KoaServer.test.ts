import { KoaServer } from "../../../../src/infrastructure/web/KoaServer";
import { KoaWishAdapter } from "../../../../src/adapters/primary/KoaWishAdapter";
import { KoaAuthenticationAdapter } from "../../../../src/adapters/primary/KoaAuthenticationAdapter";

// Mock environment variables
process.env.SESSION_SECRET = "test-session-secret";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALLBACK_URL = "/auth/google/callback";

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
jest.mock("koa-passport", () => ({
  initialize: jest.fn(() => "passport-initialize"),
  session: jest.fn(() => "passport-session"),
  authenticate: jest.fn(() => "passport-authenticate"),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
  })),
}));

// パスポート設定のモック
jest.mock("../../../../src/config/koa-passport", () => ({
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
  let mockKoaWishAdapter: KoaWishAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockKoaWishAdapter = new MockKoaWishAdapter();
  });

  describe("without authentication adapter", () => {
    let server: KoaServer;

    beforeEach(() => {
      const mockDbConnection = {};
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
      expect(mockApp.use).toHaveBeenCalledWith("passport-initialize");
      expect(mockApp.use).toHaveBeenCalledWith("passport-session");
      expect(mockApp.use).toHaveBeenCalledWith("bodyParser middleware");
      expect(mockApp.use).toHaveBeenCalledWith("static middleware");
    });

    it("should use legacy passport configuration", () => {
      const { configureKoaPassport } = require("../../../../src/config/koa-passport");
      expect(configureKoaPassport).toHaveBeenCalled();
    });

    it("should setup all required routes", () => {
      // 認証ルート
      expect(mockRouter.get).toHaveBeenCalledWith(
        "/auth/google",
        "passport-authenticate"
      );
      expect(mockRouter.get).toHaveBeenCalledWith(
        "/auth/google/callback",
        "passport-authenticate"
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

  describe("with authentication adapter", () => {
    let server: KoaServer;
    let mockAuthAdapter: jest.Mocked<KoaAuthenticationAdapter>;

    beforeEach(() => {
      mockAuthAdapter = {
        handleGoogleCallback: jest.fn(),
        serializeUser: jest.fn(),
        deserializeUser: jest.fn(),
      } as any;

      const mockDbConnection = {};
      server = new KoaServer(mockDbConnection, mockKoaWishAdapter, mockAuthAdapter);
    });

    it("should configure passport with authentication adapter", () => {
      const koaPassport = require("koa-passport");
      expect(koaPassport.serializeUser).toHaveBeenCalled();
      expect(koaPassport.deserializeUser).toHaveBeenCalled();
      expect(koaPassport.use).toHaveBeenCalled();
    });

    it("should setup Google Strategy with adapter", () => {
      const { Strategy } = require("passport-google-oauth20");
      expect(Strategy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        }),
        expect.any(Function)
      );
    });

    it("should call authentication adapter methods through passport callbacks", () => {
      const koaPassport = require("koa-passport");
      
      // Test serializeUser callback
      const serializeUserCall = koaPassport.serializeUser.mock.calls[0];
      const serializeUserCallback = serializeUserCall[0];
      const mockUser = { id: "123", name: "Test User" };
      const mockDone = jest.fn();
      
      serializeUserCallback(mockUser, mockDone);
      expect(mockAuthAdapter.serializeUser).toHaveBeenCalledWith(mockUser, mockDone);
      
      // Test deserializeUser callback
      const deserializeUserCall = koaPassport.deserializeUser.mock.calls[0];
      const deserializeUserCallback = deserializeUserCall[0];
      const mockId = "user123";
      const mockDone2 = jest.fn();
      
      deserializeUserCallback(mockId, mockDone2);
      expect(mockAuthAdapter.deserializeUser).toHaveBeenCalledWith(mockId, mockDone2);
      
      // Test Google Strategy callback
      const { Strategy } = require("passport-google-oauth20");
      const strategyCall = Strategy.mock.calls[0];
      const googleStrategyCallback = strategyCall[1];
      const mockAccessToken = "access_token";
      const mockRefreshToken = "refresh_token";
      const mockProfile = { id: "google123", displayName: "Test User" };
      const mockDone3 = jest.fn();
      
      googleStrategyCallback(mockAccessToken, mockRefreshToken, mockProfile, mockDone3);
      expect(mockAuthAdapter.handleGoogleCallback).toHaveBeenCalledWith(
        mockAccessToken,
        mockRefreshToken,
        mockProfile,
        mockDone3
      );
    });

    it("should not call legacy passport configuration", () => {
      jest.clearAllMocks();
      const mockDbConnection = {};
      new KoaServer(mockDbConnection, mockKoaWishAdapter, mockAuthAdapter);
      
      const { configureKoaPassport } = require("../../../../src/config/koa-passport");
      expect(configureKoaPassport).not.toHaveBeenCalled();
    });

    it("should setup same middleware and routes", () => {
      expect(mockApp.use).toHaveBeenCalledWith("session middleware");
      expect(mockApp.use).toHaveBeenCalledWith("passport-initialize");
      expect(mockApp.use).toHaveBeenCalledWith("passport-session");

      expect(mockRouter.get).toHaveBeenCalledWith(
        "/auth/google",
        "passport-authenticate"
      );
      expect(mockRouter.post).toHaveBeenCalledWith(
        "/api/wishes",
        expect.any(Function),
        mockKoaWishAdapter.createWish
      );
    });
  });

  describe("middleware configuration", () => {
    let server: KoaServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new KoaServer(mockDbConnection, mockKoaWishAdapter);
    });

    it("should configure session middleware with correct options", () => {
      const session = require("koa-session");
      expect(session).toHaveBeenCalledWith({}, mockApp);
    });

    it("should configure helmet CSP with correct directives", () => {
      const helmet = require("koa-helmet");
      expect(helmet.contentSecurityPolicy).toHaveBeenCalledWith({
        directives: expect.objectContaining({
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://lh4.googleusercontent.com", "https://lh5.googleusercontent.com", "https://lh6.googleusercontent.com", "https://lh1.googleusercontent.com", "https://lh2.googleusercontent.com"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "fonts.gstatic.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        }),
      });
    });
  });

  describe("authentication middleware", () => {
    let server: KoaServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new KoaServer(mockDbConnection, mockKoaWishAdapter);
    });

    it("should setup passport authentication routes", () => {
      const koaPassport = require("koa-passport");
      
      expect(koaPassport.authenticate).toHaveBeenCalledWith("google", {
        scope: ["profile", "email"],
      });
      
      expect(koaPassport.authenticate).toHaveBeenCalledWith("google", {
        successRedirect: "/",
        failureRedirect: "/",
      });
    });

    it("should protect POST routes with authentication", () => {
      const postCalls = mockRouter.post.mock.calls;
      const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
      expect(wishesPostCall).toBeDefined();
      expect(wishesPostCall[1]).toBeInstanceOf(Function); // ensureAuth middleware
    });

    it("should protect PUT routes with authentication", () => {
      const putCalls = mockRouter.put.mock.calls;
      const wishesPutCall = putCalls.find(call => call[0] === "/api/wishes");
      expect(wishesPutCall).toBeDefined();
      expect(wishesPutCall[1]).toBeInstanceOf(Function); // ensureAuth middleware
    });

    describe("ensureAuth middleware", () => {
      it("should allow authenticated users", async () => {
        const postCalls = mockRouter.post.mock.calls;
        const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
        const ensureAuth = wishesPostCall[1];

        const mockCtx = {
          isAuthenticated: jest.fn().mockReturnValue(true),
        };
        const mockNext = jest.fn();

        await ensureAuth(mockCtx, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it("should reject unauthenticated users", async () => {
        const postCalls = mockRouter.post.mock.calls;
        const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
        const ensureAuth = wishesPostCall[1];

        const mockCtx = {
          isAuthenticated: jest.fn().mockReturnValue(false),
          status: 0,
          body: null,
        };
        const mockNext = jest.fn();

        await ensureAuth(mockCtx, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockCtx.status).toBe(401);
        expect(mockCtx.body).toEqual({ error: "Unauthorized" });
      });
    });
  });

  describe("route handlers", () => {
    let server: KoaServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new KoaServer(mockDbConnection, mockKoaWishAdapter);
    });

    describe("logout route", () => {
      it("should handle logout and redirect", async () => {
        const getCalls = mockRouter.get.mock.calls;
        const logoutCall = getCalls.find(call => call[0] === "/auth/logout");
        const logoutHandler = logoutCall[1];

        const mockCtx = {
          logout: jest.fn(),
          redirect: jest.fn(),
        };

        await logoutHandler(mockCtx);

        expect(mockCtx.logout).toHaveBeenCalled();
        expect(mockCtx.redirect).toHaveBeenCalledWith("/");
      });
    });

    describe("user API route", () => {
      it("should return user from context state", () => {
        const getCalls = mockRouter.get.mock.calls;
        const userCall = getCalls.find(call => call[0] === "/api/user");
        const userHandler = userCall[1];

        const mockUser = { id: "123", name: "Test User" };
        const mockCtx = {
          state: { user: mockUser },
          body: null,
        };

        userHandler(mockCtx);

        expect(mockCtx.body).toBe(mockUser);
      });

      it("should return null when no user in context", () => {
        const getCalls = mockRouter.get.mock.calls;
        const userCall = getCalls.find(call => call[0] === "/api/user");
        const userHandler = userCall[1];

        const mockCtx = {
          state: {},
          body: null,
        };

        userHandler(mockCtx);

        expect(mockCtx.body).toBe(null);
      });
    });
  });

  describe("SPA fallback middleware", () => {
    let server: KoaServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new KoaServer(mockDbConnection, mockKoaWishAdapter);
    });

    it("should serve index.html for non-API routes", async () => {
      const middlewareCalls = mockApp.use.mock.calls;
      const spaFallbackCall = middlewareCalls.find(
        (call) => typeof call[0] === "function" && call[0].constructor.name === "AsyncFunction"
      );
      const spaHandler = spaFallbackCall[0];

      const fs = require("fs");
      const mockCtx = {
        status: 404,
        path: "/some-page",
        type: null,
        body: null,
      };

      await spaHandler(mockCtx);

      expect(mockCtx.type).toBe("html");
      expect(mockCtx.body).toBe("file-stream");
      expect(fs.createReadStream).toHaveBeenCalledWith(
        expect.stringContaining("public/index.html")
      );
    });

    it("should not handle API routes", async () => {
      const middlewareCalls = mockApp.use.mock.calls;
      const spaFallbackCall = middlewareCalls.find(
        (call) => typeof call[0] === "function" && call[0].constructor.name === "AsyncFunction"
      );
      const spaHandler = spaFallbackCall[0];

      const mockCtx = {
        status: 404,
        path: "/api/some-endpoint",
        type: null,
        body: null,
      };

      await spaHandler(mockCtx);

      // Should not modify the context for API routes
      expect(mockCtx.type).toBe(null);
      expect(mockCtx.body).toBe(null);
    });

    it("should not handle non-404 responses", async () => {
      const middlewareCalls = mockApp.use.mock.calls;
      const spaFallbackCall = middlewareCalls.find(
        (call) => typeof call[0] === "function" && call[0].constructor.name === "AsyncFunction"
      );
      const spaHandler = spaFallbackCall[0];

      const mockCtx = {
        status: 200,
        path: "/some-page",
        type: null,
        body: null,
      };

      await spaHandler(mockCtx);

      // Should not modify the context for non-404 responses
      expect(mockCtx.type).toBe(null);
      expect(mockCtx.body).toBe(null);
    });
  });

  describe("session configuration", () => {
    it("should use default session secret when not provided", () => {
      const originalSecret = process.env.SESSION_SECRET;
      delete process.env.SESSION_SECRET;

      const mockDbConnection = {};
      new KoaServer(mockDbConnection, mockKoaWishAdapter);

      expect(mockApp.keys).toEqual(["default_dev_secret"]);

      // Restore original value
      process.env.SESSION_SECRET = originalSecret;
    });

    it("should use provided session secret", () => {
      process.env.SESSION_SECRET = "custom-secret";

      const mockDbConnection = {};
      new KoaServer(mockDbConnection, mockKoaWishAdapter);

      expect(mockApp.keys).toEqual(["custom-secret"]);
    });
  });

  describe("Google OAuth configuration", () => {
    it("should use default callback URL when not provided", () => {
      const originalCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
      delete process.env.GOOGLE_CALLBACK_URL;

      const mockAuthAdapter = {
        handleGoogleCallback: jest.fn(),
        serializeUser: jest.fn(),
        deserializeUser: jest.fn(),
      } as any;

      const mockDbConnection = {};
      new KoaServer(mockDbConnection, mockKoaWishAdapter, mockAuthAdapter);

      const { Strategy } = require("passport-google-oauth20");
      expect(Strategy).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackURL: "/auth/google/callback",
        }),
        expect.any(Function)
      );

      // Restore original value
      process.env.GOOGLE_CALLBACK_URL = originalCallbackUrl;
    });
  });

  describe("configurePassportWithAdapter early return", () => {
    it("should return early when no authentication adapter provided", () => {
      // This test verifies that when no auth adapter is provided,
      // the legacy passport configuration is used instead of the adapter configuration
      const { configureKoaPassport } = require("../../../../src/config/koa-passport");
      const koaPassport = require("koa-passport");
      
      // Clear mocks before creating server to track fresh calls
      jest.clearAllMocks();
      
      const mockDbConnection = {};
      new KoaServer(mockDbConnection, mockKoaWishAdapter);

      // Since no auth adapter was provided, it should use legacy config
      expect(configureKoaPassport).toHaveBeenCalledWith(mockDbConnection);
      
      // Passport methods should not be called when using legacy config
      expect(koaPassport.serializeUser).not.toHaveBeenCalled();
      expect(koaPassport.deserializeUser).not.toHaveBeenCalled();
      expect(koaPassport.use).not.toHaveBeenCalled();
    });
  });
});