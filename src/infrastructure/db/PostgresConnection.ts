import { Pool, PoolClient, QueryResult } from "pg";
import { DatabaseConnection, DatabaseResult, DatabaseValue } from "./DatabaseConnection";
import { parse as parseDbUrl } from "pg-connection-string";
import { Logger } from "../../utils/Logger";
import { DatabaseSchemaBuilder } from "./DatabaseSchemaBuilder";

export class PostgresConnection implements DatabaseConnection {
  private pool: Pool;

  constructor() {
    // HerokuのDATABASE_URL環境変数があれば利用する
    if (process.env.DATABASE_URL) {
      // Herokuから提供されるSSL要件を満たす設定
      const connectionOptions = parseDbUrl(process.env.DATABASE_URL);
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Herokuでは自己署名証明書を使用するためfalseに設定
        },
        // Heroku向けの最適化設定
        max: 5, // Heroku無料プランでは接続数制限があるため削減
        min: 1, // 最小接続数を保持
        idleTimeoutMillis: 10000, // アイドル時間を短縮
        connectionTimeoutMillis: 5000, // 接続タイムアウトを延長
      });
    } else {
      // 開発環境の接続設定
      this.pool = new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "wishlist",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "password",
        // 開発環境向けの設定
        max: 10, // 最大接続数
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params: DatabaseValue[]): Promise<DatabaseResult> {
    const client = await this.getClient();
    try {
      const result: QueryResult = await client.query(text, params);
      // PostgreSQL の結果を DatabaseResult に変換
      return {
        rows: result.rows,
        rowCount: result.rowCount || undefined,
      };
    } finally {
      client.release();
    }
  }
  async initializeDatabase(): Promise<void> {
    // Use DatabaseSchemaBuilder for consistent schema management
    const schemaQuery = DatabaseSchemaBuilder.buildSchema('postgres');
    await this.query(schemaQuery, []);
    Logger.info("PostgreSQL database initialized");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
