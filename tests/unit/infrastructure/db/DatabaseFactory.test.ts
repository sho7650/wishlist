import { DatabaseFactory } from "../../../../src/infrastructure/db/DatabaseFactory";
import { PostgresConnection } from "../../../../src/infrastructure/db/PostgresConnection";
import { SQLiteConnection } from "../../../../src/infrastructure/db/SQLiteConnection";

// 環境変数をモック
const originalEnv = process.env;

describe("DatabaseFactory", () => {
  beforeEach(() => {
    // 環境変数をリセット
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // テスト後に環境変数を元に戻す
    process.env = originalEnv;
  });

  it("should create PostgresConnection when DB_TYPE is postgres", () => {
    // 環境変数を設定
    process.env.DB_TYPE = "postgres";

    // PostgresConnectionとSQLiteConnectionをモック
    jest.mock("../../../../src/infrastructure/db/PostgresConnection", () => ({
      PostgresConnection: jest.fn().mockImplementation(() => ({
        type: "postgres",
      })),
    }));

    jest.mock("../../../../src/infrastructure/db/SQLiteConnection", () => ({
      SQLiteConnection: jest.fn().mockImplementation(() => ({
        type: "sqlite",
      })),
    }));

    // テスト対象を再読み込み
    const factory =
      require("../../../../src/infrastructure/db/DatabaseFactory").DatabaseFactory;

    // 実行
    const connection = factory.createConnection();

    // 検証
    expect(connection.type).toBe("postgres");
  });

  it("should create SQLiteConnection when DB_TYPE is sqlite", () => {
    // 環境変数を設定
    process.env.DB_TYPE = "sqlite";

    // PostgresConnectionとSQLiteConnectionをモック
    jest.mock("../../../../src/infrastructure/db/PostgresConnection", () => ({
      PostgresConnection: jest.fn().mockImplementation(() => ({
        type: "postgres",
      })),
    }));

    jest.mock("../../../../src/infrastructure/db/SQLiteConnection", () => ({
      SQLiteConnection: jest.fn().mockImplementation(() => ({
        type: "sqlite",
      })),
    }));

    // テスト対象を再読み込み
    const factory =
      require("../../../../src/infrastructure/db/DatabaseFactory").DatabaseFactory;

    // 実行
    const connection = factory.createConnection();

    // 検証
    expect(connection.type).toBe("sqlite");
  });

  it("should use SQLiteConnection as default when DB_TYPE is not specified", () => {
    // 環境変数をクリア
    delete process.env.DB_TYPE;

    // PostgresConnectionとSQLiteConnectionをモック
    jest.mock("../../../../src/infrastructure/db/PostgresConnection", () => ({
      PostgresConnection: jest.fn().mockImplementation(() => ({
        type: "postgres",
      })),
    }));

    jest.mock("../../../../src/infrastructure/db/SQLiteConnection", () => ({
      SQLiteConnection: jest.fn().mockImplementation(() => ({
        type: "sqlite",
      })),
    }));

    // テスト対象を再読み込み
    const factory =
      require("../../../../src/infrastructure/db/DatabaseFactory").DatabaseFactory;

    // 実行
    const connection = factory.createConnection();

    // 検証
    expect(connection.type).toBe("sqlite");
  });

  it("should use PostgresConnection when DATABASE_URL is set (Heroku environment)", () => {
    // Heroku環境をシミュレート
    process.env.DATABASE_URL = "postgres://user:password@host:5432/database";

    // PostgresConnectionとSQLiteConnectionをモック
    jest.mock("../../../../src/infrastructure/db/PostgresConnection", () => ({
      PostgresConnection: jest.fn().mockImplementation(() => ({
        type: "postgres",
      })),
    }));

    jest.mock("../../../../src/infrastructure/db/SQLiteConnection", () => ({
      SQLiteConnection: jest.fn().mockImplementation(() => ({
        type: "sqlite",
      })),
    }));

    // テスト対象を再読み込み
    const factory =
      require("../../../../src/infrastructure/db/DatabaseFactory").DatabaseFactory;

    // 実行
    const connection = factory.createConnection();

    // 検証
    expect(connection.type).toBe("postgres");
  });
});
