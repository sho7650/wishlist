import { DatabaseFactory } from "../../../../src/infrastructure/db/DatabaseFactory";
import { PostgresConnection } from "../../../../src/infrastructure/db/PostgresConnection";

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

  it("should always create PostgresConnection for high performance", () => {
    // PostgreSQLのみをサポートし、高速化を実現
    const connection = DatabaseFactory.createConnection();
    
    // 検証 - PostgresConnectionのインスタンスが作成される
    expect(connection).toBeInstanceOf(PostgresConnection);
  });

  it("should create PostgresConnection regardless of environment variables", () => {
    // 環境変数を設定してもPostgreSQLのみを使用
    process.env.DB_TYPE = "sqlite";
    process.env.DATABASE_URL = "postgres://user:password@host:5432/database";

    const connection = DatabaseFactory.createConnection();
    
    // 検証 - 常にPostgresConnectionが作成される
    expect(connection).toBeInstanceOf(PostgresConnection);
  });

  it("should create PostgresConnection when no environment variables are set", () => {
    // 環境変数をクリア
    delete process.env.DB_TYPE;
    delete process.env.DATABASE_URL;

    const connection = DatabaseFactory.createConnection();
    
    // 検証 - デフォルトでもPostgresConnectionが作成される
    expect(connection).toBeInstanceOf(PostgresConnection);
  });
});
