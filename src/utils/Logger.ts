export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export class Logger {
  private static testLogLevel?: LogLevel;

  // Test用のログレベル設定機能
  static setLevel(level: LogLevel): void {
    this.testLogLevel = level;
  }

  static resetLevel(): void {
    this.testLogLevel = undefined;
  }

  private static get currentLogLevel(): LogLevel {
    if (this.testLogLevel !== undefined) {
      return this.testLogLevel;
    }
    const logLevel = process.env.LOG_LEVEL?.toLowerCase();
    
    switch (logLevel) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        // デフォルトは本番環境ではERROR、開発環境ではINFO
        return process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.INFO;
    }
  }

  private static shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel;
  }

  static log(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(message, ...args);
    }
  }

  static error(message: string, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(message, error);
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(message, ...args);
    }
  }

  static info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(message, ...args);
    }
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(message, ...args);
    }
  }
}