import { Logger } from "../../../src/utils/Logger";

describe("Logger", () => {
  let originalNodeEnv: string | undefined;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalLogLevel = process.env.LOG_LEVEL;
    // Reset console spies before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });

  describe("LOG_LEVEL=error", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "error";
    });

    it("should only log error messages", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();

      Logger.error("error message");
      Logger.warn("warn message");
      Logger.info("info message");
      Logger.debug("debug message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe("LOG_LEVEL=warn", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "warn";
    });

    it("should log error and warn messages", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();

      Logger.error("error message");
      Logger.warn("warn message");
      Logger.info("info message");
      Logger.debug("debug message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(warnSpy).toHaveBeenCalledWith("warn message");
      expect(infoSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe("LOG_LEVEL=info", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "info";
    });

    it("should log error, warn, and info messages", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();

      Logger.error("error message");
      Logger.warn("warn message");
      Logger.info("info message");
      Logger.debug("debug message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(warnSpy).toHaveBeenCalledWith("warn message");
      expect(infoSpy).toHaveBeenCalledWith("info message");
      expect(debugSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe("LOG_LEVEL=debug", () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = "debug";
    });

    it("should log all message types", () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();

      Logger.error("error message");
      Logger.warn("warn message");
      Logger.info("info message");
      Logger.debug("debug message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(warnSpy).toHaveBeenCalledWith("warn message");
      expect(infoSpy).toHaveBeenCalledWith("info message");
      expect(debugSpy).toHaveBeenCalledWith("debug message");

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe("default behavior", () => {
    it("should use ERROR level in production environment", () => {
      process.env.NODE_ENV = "production";
      delete process.env.LOG_LEVEL;

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();

      Logger.error("error message");
      Logger.info("info message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(infoSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it("should use INFO level in development environment", () => {
      process.env.NODE_ENV = "development";
      delete process.env.LOG_LEVEL;

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const infoSpy = jest.spyOn(console, "info").mockImplementation();
      const debugSpy = jest.spyOn(console, "debug").mockImplementation();

      Logger.error("error message");
      Logger.info("info message");
      Logger.debug("debug message");

      expect(errorSpy).toHaveBeenCalledWith("error message", undefined);
      expect(infoSpy).toHaveBeenCalledWith("info message");
      expect(debugSpy).not.toHaveBeenCalled();

      errorSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe("error method with Error object", () => {
    it("should log error message with Error object", () => {
      process.env.LOG_LEVEL = "error";
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const error = new Error("test error");

      Logger.error("error message", error);

      expect(errorSpy).toHaveBeenCalledWith("error message", error);

      errorSpy.mockRestore();
    });
  });

  describe("log method", () => {
    it("should behave like info level", () => {
      process.env.LOG_LEVEL = "info";
      const logSpy = jest.spyOn(console, "log").mockImplementation();

      Logger.log("log message", "arg1", "arg2");

      expect(logSpy).toHaveBeenCalledWith("log message", "arg1", "arg2");

      logSpy.mockRestore();
    });

    it("should not log when level is below info", () => {
      process.env.LOG_LEVEL = "warn";
      const logSpy = jest.spyOn(console, "log").mockImplementation();

      Logger.log("log message");

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});