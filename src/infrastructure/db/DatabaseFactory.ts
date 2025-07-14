import { DatabaseConnection } from "./DatabaseConnection";
import { PostgresConnection } from "./PostgresConnection";
import { MySQLConnection } from "./MySQLConnection";
import { SQLiteConnection } from "./SQLiteConnection";
import { QueryExecutor } from "./query/QueryExecutor";
import { PostgresQueryExecutor } from "./query/PostgresQueryExecutor";
import { MySQLQueryExecutor } from "./query/MySQLQueryExecutor";
import { SQLiteQueryExecutor } from "./query/SQLiteQueryExecutor";
import { Logger } from "../../utils/Logger";

export type DatabaseType = 'postgres' | 'mysql' | 'sqlite';

export class DatabaseFactory {
  static createConnection(): DatabaseConnection {
    const dbType = this.getDatabaseType();
    Logger.info(`Creating database connection: ${dbType}`);

    switch (dbType) {
      case 'postgres':
        return new PostgresConnection();
      case 'mysql':
        return new MySQLConnection();
      case 'sqlite':
        return new SQLiteConnection();
      default:
        Logger.warn(`Unknown database type: ${dbType}, falling back to PostgreSQL`);
        return new PostgresConnection();
    }
  }

  static createQueryExecutor(connection: DatabaseConnection): QueryExecutor {
    const dbType = this.getDatabaseType();
    Logger.info(`Creating query executor: ${dbType}`);

    switch (dbType) {
      case 'postgres':
        return new PostgresQueryExecutor(connection);
      case 'mysql':
        return new MySQLQueryExecutor(connection);
      case 'sqlite':
        return new SQLiteQueryExecutor(connection);
      default:
        Logger.warn(`Unknown database type: ${dbType}, falling back to PostgreSQL`);
        return new PostgresQueryExecutor(connection);
    }
  }

  private static getDatabaseType(): DatabaseType {
    const dbType = process.env.DB_TYPE?.toLowerCase() as DatabaseType;
    
    // Validate supported database types
    const supportedTypes: DatabaseType[] = ['postgres', 'mysql', 'sqlite'];
    if (dbType && supportedTypes.includes(dbType)) {
      return dbType;
    }
    
    // Default to PostgreSQL for production reliability
    return 'postgres';
  }

  static getSupportedDatabaseTypes(): DatabaseType[] {
    return ['postgres', 'mysql', 'sqlite'];
  }
}
