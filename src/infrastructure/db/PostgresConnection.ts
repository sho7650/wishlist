import { Pool, PoolClient, QueryResult } from "pg";
import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import { parse as parseDbUrl } from "pg-connection-string";
import { Logger } from "../../utils/Logger";

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
        acquireTimeoutMillis: 10000, // 接続取得タイムアウト
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
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wishes (
        id UUID PRIMARY KEY,
        name TEXT,
        wish TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        support_count INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        wish_id UUID NOT NULL REFERENCES wishes(id),
        created_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS supports (
        id SERIAL PRIMARY KEY,
        wish_id UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
        session_id TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- パフォーマンス最適化のためのインデックス
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session 
      ON supports(wish_id, session_id) WHERE session_id IS NOT NULL;
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user 
      ON supports(wish_id, user_id) WHERE user_id IS NOT NULL;
      
      -- 高速クエリのための追加インデックス
      CREATE INDEX IF NOT EXISTS idx_wishes_created_at 
      ON wishes(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_wishes_user_id 
      ON wishes(user_id) WHERE user_id IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_supports_wish_id 
      ON supports(wish_id);
    `;

    await this.query(createTablesQuery, []);
    Logger.info("PostgreSQL database initialized");
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
