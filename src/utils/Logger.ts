export class Logger {
  private static get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  static log(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.log(message, ...args);
    }
  }

  static error(message: string, error?: Error): void {
    console.error(message, error);
  }

  static warn(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.warn(message, ...args);
    }
  }

  static info(message: string, ...args: any[]): void {
    if (!this.isProduction) {
      console.info(message, ...args);
    }
  }

  static debug(message: string, ...args: any[]): void {
    if (!this.isProduction && process.env.DEBUG) {
      console.debug(message, ...args);
    }
  }
}