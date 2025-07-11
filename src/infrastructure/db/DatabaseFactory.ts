import { DatabaseConnection } from "./DatabaseConnection";
import { PostgresConnection } from "./PostgresConnection";

export class DatabaseFactory {
  static createConnection(): DatabaseConnection {
    // PostgreSQLのみをサポートし、高速化を実現
    return new PostgresConnection();
  }
}
