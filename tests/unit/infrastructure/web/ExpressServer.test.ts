import { ExpressServer } from "../../../../src/infrastructure/web/ExpressServer";
import { WishController } from "../../../../src/adapters/primary/ExpressWishController";
import { ExpressAuthenticationAdapter } from "../../../../src/adapters/primary/ExpressAuthenticationAdapter";

// Mock environment variables
process.env.SESSION_SECRET = "test-session-secret";
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALLBACK_URL = "/auth/google/callback";

// --- モックの設定 ---
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
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
  contentSecurityPolicy: jest.fn(() => "csp middleware"),
}));
jest.mock("express-session", () => jest.fn(() => "session middleware"));
jest.mock("passport", () => ({
  initialize: jest.fn(() => "passport initialize middleware"),
  session: jest.fn(() => "passport session middleware"),
  authenticate: jest.fn(() => "passport authenticate middleware"),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(),
  })),
}));
jest.mock("../../../../src/config/express-passport", () => ({
  configureExpressPassport: jest.fn(),
}));

// Controllerのモック
class MockWishController extends WishController {
  constructor() {
    super(
      {} as any, {} as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, {} as any
    );
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

describe("ExpressServer", () => {
  let mockWishController: MockWishController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWishController = new MockWishController();
  });

  describe("without authentication adapter", () => {
    let server: ExpressServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController);
    });

    it("should setup all required middleware", () => {
      expect(mockApp.use).toHaveBeenCalledWith("session middleware");
      expect(mockApp.use).toHaveBeenCalledWith("passport initialize middleware");
      expect(mockApp.use).toHaveBeenCalledWith("passport session middleware");
      expect(mockApp.use).toHaveBeenCalledWith("csp middleware");
      expect(mockApp.use).toHaveBeenCalledWith("json middleware");
      expect(mockApp.use).toHaveBeenCalledWith("cookieParser middleware");
    });

    it("should use legacy passport configuration", () => {
      const { configureExpressPassport } = require("../../../../src/config/express-passport");
      expect(configureExpressPassport).toHaveBeenCalled();
    });

    it("should setup all required routes", () => {
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
      expect(mockApp.get).toHaveBeenCalledWith(/.*/, expect.any(Function));
    });

    it("should setup authentication routes", () => {
      expect(mockApp.get).toHaveBeenCalledWith(
        "/auth/google",
        "passport authenticate middleware"
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        "/auth/google/callback",
        "passport authenticate middleware"
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        "/auth/logout",
        expect.any(Function)
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        "/api/user",
        expect.any(Function)
      );
    });

    it("should setup support routes", () => {
      expect(mockApp.post).toHaveBeenCalledWith(
        "/api/wishes/:wishId/support",
        mockWishController.supportWish
      );
      expect(mockApp.delete).toHaveBeenCalledWith(
        "/api/wishes/:wishId/support",
        mockWishController.unsupportWish
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        "/api/wishes/:wishId/support",
        mockWishController.getWishSupportStatus
      );
    });

    it("should SPA fallback to index.html for non-API routes", () => {
      const fallbackRoute = mockApp.get.mock.calls.find(
        (call) => call[0] instanceof RegExp && call[0].test("/public/index.html")
      );
      expect(fallbackRoute).toBeDefined();
      expect(fallbackRoute[1]).toBeInstanceOf(Function);
    });

    it("should serve static files from the public directory", () => {
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should start the server on the specified port", () => {
      const port = 3000;
      server.start(port);
      expect(mockApp.listen).toHaveBeenCalledWith(port, expect.any(Function));
    });
  });

  describe("with authentication adapter", () => {
    let server: ExpressServer;
    let mockAuthAdapter: jest.Mocked<ExpressAuthenticationAdapter>;

    beforeEach(() => {
      mockAuthAdapter = {
        handleGoogleCallback: jest.fn(),
        serializeUser: jest.fn(),
        deserializeUser: jest.fn(),
        requireAuth: jest.fn(),
      } as any;

      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController, mockAuthAdapter);
    });

    it("should configure passport with authentication adapter", () => {
      const passport = require("passport");
      expect(passport.serializeUser).toHaveBeenCalled();
      expect(passport.deserializeUser).toHaveBeenCalled();
      expect(passport.use).toHaveBeenCalled();
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

    it("should not call legacy passport configuration", () => {
      jest.clearAllMocks();
      const mockDbConnection = {};
      new ExpressServer(mockDbConnection, mockWishController, mockAuthAdapter);
      
      const { configureExpressPassport } = require("../../../../src/config/express-passport");
      expect(configureExpressPassport).not.toHaveBeenCalled();
    });

    it("should setup same middleware and routes", () => {
      expect(mockApp.use).toHaveBeenCalledWith("session middleware");
      expect(mockApp.use).toHaveBeenCalledWith("passport initialize middleware");
      expect(mockApp.use).toHaveBeenCalledWith("passport session middleware");

      expect(mockApp.get).toHaveBeenCalledWith(
        "/auth/google",
        "passport authenticate middleware"
      );
      expect(mockApp.post).toHaveBeenCalledWith(
        "/api/wishes",
        expect.any(Function),
        mockWishController.createWish
      );
    });
  });

  describe("middleware configuration", () => {
    let server: ExpressServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController);
    });

    it("should configure session middleware with correct options", () => {
      const session = require("express-session");
      expect(session).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: process.env.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
          cookie: { maxAge: 24 * 60 * 60 * 1000 },
        })
      );
    });

    it("should configure helmet CSP with correct directives", () => {
      const helmet = require("helmet");
      expect(helmet.contentSecurityPolicy).toHaveBeenCalledWith({
        directives: expect.objectContaining({
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "lh3.googleusercontent.com"],
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
    let server: ExpressServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController);
    });

    it("should setup passport authentication routes", () => {
      const passport = require("passport");
      
      expect(passport.authenticate).toHaveBeenCalledWith("google", {
        scope: ["profile", "email"],
      });
      
      expect(passport.authenticate).toHaveBeenCalledWith("google", {
        successRedirect: "/",
        failureRedirect: "/",
      });
    });

    it("should protect POST routes with authentication", () => {
      const postCalls = mockApp.post.mock.calls;
      const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
      expect(wishesPostCall).toBeDefined();
      expect(wishesPostCall[1]).toBeInstanceOf(Function); // ensureAuth middleware
    });

    it("should protect PUT routes with authentication", () => {
      const putCalls = mockApp.put.mock.calls;
      const wishesPutCall = putCalls.find(call => call[0] === "/api/wishes");
      expect(wishesPutCall).toBeDefined();
      expect(wishesPutCall[1]).toBeInstanceOf(Function); // ensureAuth middleware
    });
  });

  describe("route handlers", () => {
    let server: ExpressServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController);
    });

    describe("logout route", () => {
      it("should handle logout with callback and redirect", () => {
        const getCalls = mockApp.get.mock.calls;
        const logoutCall = getCalls.find(call => call[0] === "/auth/logout");
        const logoutHandler = logoutCall[1];

        const mockReq = {
          logout: jest.fn((callback) => {
            // Simulate passport logout calling the callback
            callback();
          }),
        };
        const mockRes = {
          redirect: jest.fn(),
        };

        logoutHandler(mockReq, mockRes);

        expect(mockReq.logout).toHaveBeenCalled();
        expect(mockRes.redirect).toHaveBeenCalledWith("/");
      });
    });

    describe("user API route", () => {
      it("should return user from request object", () => {
        const getCalls = mockApp.get.mock.calls;
        const userCall = getCalls.find(call => call[0] === "/api/user");
        const userHandler = userCall[1];

        const mockUser = { id: "123", name: "Test User" };
        const mockReq = { user: mockUser };
        const mockRes = { send: jest.fn() };

        userHandler(mockReq, mockRes);

        expect(mockRes.send).toHaveBeenCalledWith(mockUser);
      });

      it("should return undefined when no user in request", () => {
        const getCalls = mockApp.get.mock.calls;
        const userCall = getCalls.find(call => call[0] === "/api/user");
        const userHandler = userCall[1];

        const mockReq = {}; // No user property
        const mockRes = { send: jest.fn() };

        userHandler(mockReq, mockRes);

        expect(mockRes.send).toHaveBeenCalledWith(undefined);
      });
    });

    describe("ensureAuth middleware", () => {
      it("should allow authenticated users", () => {
        const postCalls = mockApp.post.mock.calls;
        const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
        const ensureAuth = wishesPostCall[1];

        const mockReq = {
          isAuthenticated: jest.fn().mockReturnValue(true),
        };
        const mockRes = {};
        const mockNext = jest.fn();

        ensureAuth(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it("should reject unauthenticated users", () => {
        const postCalls = mockApp.post.mock.calls;
        const wishesPostCall = postCalls.find(call => call[0] === "/api/wishes");
        const ensureAuth = wishesPostCall[1];

        const mockReq = {
          isAuthenticated: jest.fn().mockReturnValue(false),
        };
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          send: jest.fn(),
        };
        const mockNext = jest.fn();

        ensureAuth(mockReq, mockRes, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.send).toHaveBeenCalledWith("Unauthorized");
      });
    });
  });

  describe("SPA fallback middleware", () => {
    let server: ExpressServer;

    beforeEach(() => {
      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController);
    });

    it("should serve index.html for non-API routes", () => {
      const getCalls = mockApp.get.mock.calls;
      const fallbackCall = getCalls.find(call => call[0] instanceof RegExp);
      const fallbackHandler = fallbackCall[1];

      const mockReq = { path: "/some-page" };
      const mockRes = { sendFile: jest.fn() };
      const mockNext = jest.fn();

      fallbackHandler(mockReq, mockRes, mockNext);

      expect(mockRes.sendFile).toHaveBeenCalledWith(
        expect.stringContaining("public/index.html")
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should not handle API routes", () => {
      const getCalls = mockApp.get.mock.calls;
      const fallbackCall = getCalls.find(call => call[0] instanceof RegExp);
      const fallbackHandler = fallbackCall[1];

      const mockReq = { path: "/api/some-endpoint" };
      const mockRes = { sendFile: jest.fn() };
      const mockNext = jest.fn();

      fallbackHandler(mockReq, mockRes, mockNext);

      expect(mockRes.sendFile).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("authentication adapter callback functions", () => {
    let server: ExpressServer;
    let mockAuthAdapter: jest.Mocked<ExpressAuthenticationAdapter>;

    beforeEach(() => {
      mockAuthAdapter = {
        handleGoogleCallback: jest.fn(),
        serializeUser: jest.fn(),
        deserializeUser: jest.fn(),
        requireAuth: jest.fn(),
      } as any;

      const mockDbConnection = {};
      server = new ExpressServer(mockDbConnection, mockWishController, mockAuthAdapter);
    });

    it("should call authentication adapter methods through passport callbacks", () => {
      const passport = require("passport");
      
      // Test serializeUser callback
      const serializeUserCall = passport.serializeUser.mock.calls[0];
      const serializeUserCallback = serializeUserCall[0];
      const mockUser = { id: "123", name: "Test User" };
      const mockDone = jest.fn();
      
      serializeUserCallback(mockUser, mockDone);
      expect(mockAuthAdapter.serializeUser).toHaveBeenCalledWith(mockUser, mockDone);
      
      // Test deserializeUser callback
      const deserializeUserCall = passport.deserializeUser.mock.calls[0];
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
  });
});