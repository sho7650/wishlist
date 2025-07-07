import { DatabaseConnection } from "./DatabaseConnection";
import { PostgresConnection } from "./PostgresConnection";
import { SQLiteConnection } from "./SQLiteConnection";

export class DatabaseFactory {
  static createConnection(): DatabaseConnection {
    // Herokuの環境変数DATABASE_URLがある場合は強制的にPostgreSQLを使用
    if (process.env.DATABASE_URL) {
      console.log("Heroku environment detected, using PostgreSQL");
      return new PostgresConnection();
    }

    // 通常環境では環境変数で選択可能
    const dbType = process.env.DB_TYPE || "sqlite";

    switch (dbType.toLowerCase()) {
      case "postgres":
      case "postgresql":
        return new PostgresConnection();
      case "sqlite":
      default:
        return new SQLiteConnection();
    }
  }
}
