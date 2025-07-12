import { Logger } from "../../../src/utils/Logger";

describe("Logger", () => {
  let consoleSpy: jest.SpyInstance;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    // Reset console spies before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    
    // Restore console methods if they were spied on
    if (consoleSpy) {
      consoleSpy.mockRestore();
    }
  });

  describe("log", () => {
    it("should call console.log in non-production environment", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      consoleSpy = jest.spyOn(console, "log").mockImplementation();

      // Act
      Logger.log("test message", "arg1", "arg2");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test message", "arg1", "arg2");
    });

    it("should not call console.log in production environment", () => {
      // Arrange
      process.env.NODE_ENV = "production";
      consoleSpy = jest.spyOn(console, "log").mockImplementation();

      // Act
      Logger.log("test message");

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should always call console.error regardless of environment", () => {
      // Arrange
      process.env.NODE_ENV = "production";
      consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("test error");

      // Act
      Logger.error("test error message", error);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test error message", error);
    });

    it("should call console.error without error object", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Act
      Logger.error("test error message");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test error message", undefined);
    });
  });

  describe("warn", () => {
    it("should call console.warn in non-production environment", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      // Act
      Logger.warn("test warning", "arg1");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test warning", "arg1");
    });

    it("should not call console.warn in production environment", () => {
      // Arrange
      process.env.NODE_ENV = "production";
      consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      // Act
      Logger.warn("test warning");

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("info", () => {
    it("should call console.info in non-production environment", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      consoleSpy = jest.spyOn(console, "info").mockImplementation();

      // Act
      Logger.info("test info", "arg1");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test info", "arg1");
    });

    it("should not call console.info in production environment", () => {
      // Arrange
      process.env.NODE_ENV = "production";
      consoleSpy = jest.spyOn(console, "info").mockImplementation();

      // Act
      Logger.info("test info");

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("debug", () => {
    it("should call console.debug when DEBUG env var is set and not in production", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      process.env.DEBUG = "true";
      consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      // Act
      Logger.debug("test debug", "arg1");

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith("test debug", "arg1");
      
      // Cleanup DEBUG env var
      delete process.env.DEBUG;
    });

    it("should not call console.debug when DEBUG env var is not set", () => {
      // Arrange
      process.env.NODE_ENV = "development";
      delete process.env.DEBUG;
      consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      // Act
      Logger.debug("test debug");

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should not call console.debug in production environment even with DEBUG set", () => {
      // Arrange
      process.env.NODE_ENV = "production";
      process.env.DEBUG = "true";
      consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      // Act
      Logger.debug("test debug");

      // Assert
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Cleanup DEBUG env var
      delete process.env.DEBUG;
    });
  });
});