import { Pool, PoolClient, QueryResult } from "pg";
import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import { parse as parseDbUrl } from "pg-connection-string";

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
      });
      console.log("Using Heroku PostgreSQL connection");
    } else {
      // 通常の接続設定
      this.pool = new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "wishlist",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "password",
      });
      console.log("Using standard PostgreSQL connection");
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query(text: string, params: any[]): Promise<DatabaseResult> {
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
    // テーブル作成クエリ
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS wishes (
        id UUID PRIMARY KEY,
        name TEXT,
        wish TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        wish_id UUID NOT NULL REFERENCES wishes(id),
        created_at TIMESTAMP NOT NULL
      );
    `;

    await this.query(createTablesQuery, []);
    console.log("PostgreSQL database initialized");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
