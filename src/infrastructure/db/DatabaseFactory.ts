import { DatabaseConnection } from "./DatabaseConnection";
import { PostgresConnection } from "./PostgresConnection";
import { QueryExecutor } from "./query/QueryExecutor";
import { PostgresQueryExecutor } from "./query/PostgresQueryExecutor";

export class DatabaseFactory {
  static createConnection(): DatabaseConnection {
    // PostgreSQLのみをサポートし、高速化を実現
    return new PostgresConnection();
  }

  static createQueryExecutor(connection: DatabaseConnection): QueryExecutor {
    // 現在はPostgreSQLのみサポート、将来的に他のDBも対応予定
    return new PostgresQueryExecutor(connection);
  }
}
