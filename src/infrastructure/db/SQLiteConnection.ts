import sqlite3 from "sqlite3";
import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import path from "path";
import fs from "fs";
import { promisify } from "util";

export class SQLiteConnection implements DatabaseConnection {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor() {
    const dbDir = process.env.SQLITE_DB_DIR || "./data";
    this.dbPath = path.resolve(
      process.env.SQLITE_DB_PATH || path.join(dbDir, "wishlist.sqlite")
    );

    // データベースディレクトリの作成
    if (!fs.existsSync(path.dirname(this.dbPath))) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    // SQLite3はコールバックベースのAPIを使用
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error("Could not connect to database", err);
      } else {
        console.log(`SQLite database initialized at ${this.dbPath}`);
      }
    });
  }

  // SQLite用に値を変換するヘルパーメソッド
  private convertValueForSQLite(value: any): any {
    if (value instanceof Date) {
      // Date オブジェクトを ISO 文字列に変換
      return value.toISOString();
    } else if (value === null || value === undefined) {
      return null;
    } else if (typeof value === "object") {
      // オブジェクトをJSONに変換
      return JSON.stringify(value);
    }
    return value;
  }

  async query(text: string, params: any[]): Promise<DatabaseResult> {
    // パラメータをSQLite互換の型に変換
    const convertedParams = params.map((param) =>
      this.convertValueForSQLite(param)
    );

    // SQLiteはPostgreSQLと構文が若干異なるため、必要に応じてクエリを変換
    const sqliteQuery = this.convertPostgresToSQLite(text);

    // SQLite3のコールバックAPIをPromiseに変換
    return new Promise<DatabaseResult>((resolve, reject) => {
      if (sqliteQuery.toLowerCase().trim().startsWith("select")) {
        // SELECTクエリの場合はall()メソッドを使用
        this.db.all(sqliteQuery, convertedParams, (err, rows) => {
          if (err) {
            console.error("SQLite query error:", err);
            console.error("Query:", sqliteQuery);
            console.error("Params:", convertedParams);
            return reject(err);
          }

          // 日付文字列を適切に処理
          const processedRows = rows.map((row: any) => {
            const processedRow = { ...row };
            // created_at フィールドを標準的なISO形式に変換
            if (
              processedRow.created_at &&
              typeof processedRow.created_at === "string"
            ) {
              try {
                // 日付をチェックするだけ (実際の変換はリポジトリで行う)
                const testDate = new Date(processedRow.created_at);
                if (isNaN(testDate.getTime())) {
                  // 無効な日付文字列の場合、現在時刻のISO文字列を使用
                  console.warn(
                    `Invalid date in DB: ${processedRow.created_at}, using current date`
                  );
                  processedRow.created_at = new Date().toISOString();
                }
              } catch (e) {
                console.error(
                  `Error processing date: ${processedRow.created_at}`,
                  e
                );
                processedRow.created_at = new Date().toISOString();
              }
            }
            return processedRow;
          });

          resolve({ rows: processedRows, rowCount: processedRows.length });
        });
      } else {
        // INSERT/UPDATE/DELETE/CREATE クエリの場合はrun()メソッドを使用
        this.db.run(sqliteQuery, convertedParams, function (err) {
          if (err) {
            console.error("SQLite query error:", err);
            console.error("Query:", sqliteQuery);
            console.error("Params:", convertedParams);
            return reject(err);
          }

          // this.changes はSQLite3の変更された行数
          // function キーワードを使用して this にアクセス
          resolve({ rows: [], rowCount: this.changes });
        });
      }
    });
  }

  async initializeDatabase(): Promise<void> {
    // Promisify the exec method
    const exec = promisify<string, void>(this.db.exec.bind(this.db));

    try {
      // 外部キー制約を有効化
      await exec("PRAGMA foreign_keys = ON;");

      // テーブル作成クエリ
      const createWishesTable = `
        CREATE TABLE IF NOT EXISTS wishes (
          id TEXT PRIMARY KEY,
          name TEXT,
          wish TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          session_id TEXT PRIMARY KEY,
          wish_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (wish_id) REFERENCES wishes(id)
        );
      `;

      await exec(createWishesTable);
      await exec(createSessionsTable);

      console.log("SQLite database tables initialized");
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  // PostgreSQLのクエリをSQLite用に変換するヘルパーメソッド
  private convertPostgresToSQLite(query: string): string {
    // 1. $1, $2 パラメータプレースホルダーを ? に変換
    let sqliteQuery = query.replace(/\$\d+/g, "?");

    // 2. RETURNING 句を削除 (SQLiteはサポートしていない)
    sqliteQuery = sqliteQuery.replace(/\s+RETURNING\s+.*$/i, "");

    // 3. ON CONFLICT ... DO UPDATE を REPLACE INTO に変換するロジック
    if (sqliteQuery.includes("ON CONFLICT")) {
      // INSERT文をシンプルなINSERT OR REPLACEに変換
      sqliteQuery = sqliteQuery.replace(
        /INSERT INTO/i,
        "INSERT OR REPLACE INTO"
      );
      // ON CONFLICT以降の部分を削除
      sqliteQuery = sqliteQuery.replace(/\s+ON CONFLICT.*DO UPDATE.*$/is, "");
    }
    // 4. OFFSETの処理（SQLiteでも同じ構文だが、念のため）
    if (sqliteQuery.includes("OFFSET")) {
      // OFFSET構文をそのまま使用（SQLiteでもサポートされている）
      // 特に変換は不要
    }

    return sqliteQuery;
  }
}
