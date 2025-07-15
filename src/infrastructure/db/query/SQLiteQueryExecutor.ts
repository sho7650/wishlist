import { DatabaseConnection, DatabaseResult } from "../DatabaseConnection";
import { BaseQueryExecutor } from "./BaseQueryExecutor";
import { SQLitePlaceholderStrategy } from "./QueryPlaceholderStrategy";

/**
 * SQLite-specific QueryExecutor implementation
 * 
 * This class now extends BaseQueryExecutor, eliminating ~90% of duplicate code.
 * Only SQLite-specific features like UPSERT and support count updates are implemented here.
 */
export class SQLiteQueryExecutor extends BaseQueryExecutor {
  constructor(connection: DatabaseConnection) {
    super(connection, new SQLitePlaceholderStrategy());
  }

  /**
   * SQLite-specific UPSERT using ON CONFLICT syntax
   * SQLite uses 'excluded' (lowercase) instead of 'EXCLUDED'
   */
  async upsert(table: string, data: Record<string, any>, conflictColumns: string[]): Promise<DatabaseResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?');

    // SQLite specific INSERT OR REPLACE / ON CONFLICT syntax
    // Exclude conflict columns and timestamp fields that shouldn't be updated
    const excludeFromUpdate = [...conflictColumns, 'created_at'];
    const updateClauses = columns
      .filter(col => !excludeFromUpdate.includes(col))
      .map(col => `${col} = excluded.${col}`); // SQLite uses lowercase 'excluded'

    const conflictClause = updateClauses.length > 0 
      ? `ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateClauses.join(', ')}`
      : `ON CONFLICT (${conflictColumns.join(', ')}) DO NOTHING`;

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ${conflictClause}
    `;

    return this.connection.query(query, values);
  }

  /**
   * SQLite-specific decrement support count using MAX function
   */
  async decrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `UPDATE wishes SET support_count = MAX(support_count - 1, 0) WHERE id = ?`;
    return this.connection.query(query, [wishId]);
  }

  /**
   * SQLite-specific atomic support count update
   * SQLite requires the parameter twice for the subquery and WHERE clause
   */
  async updateSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `
      UPDATE wishes 
      SET support_count = (
        SELECT COUNT(*) FROM supports WHERE wish_id = ?
      ) 
      WHERE id = ?
    `;
    return this.connection.query(query, [wishId, wishId]);
  }
}