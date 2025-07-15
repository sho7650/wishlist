import { DatabaseConnection, DatabaseResult } from "../DatabaseConnection";
import { BaseQueryExecutor } from "./BaseQueryExecutor";
import { MySQLPlaceholderStrategy } from "./QueryPlaceholderStrategy";

/**
 * MySQL-specific QueryExecutor implementation
 * 
 * This class now extends BaseQueryExecutor, eliminating ~90% of duplicate code.
 * Only MySQL-specific features like UPSERT and support count updates are implemented here.
 */
export class MySQLQueryExecutor extends BaseQueryExecutor {
  constructor(connection: DatabaseConnection) {
    super(connection, new MySQLPlaceholderStrategy());
  }

  /**
   * MySQL-specific UPSERT using ON DUPLICATE KEY UPDATE syntax
   * MySQL uses VALUES() function to reference new values
   */
  async upsert(table: string, data: Record<string, any>, conflictColumns: string[]): Promise<DatabaseResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map(() => '?');

    // MySQL specific ON DUPLICATE KEY UPDATE syntax
    // Exclude conflict columns and timestamp fields that shouldn't be updated
    const excludeFromUpdate = [...conflictColumns, 'created_at'];
    const updateClauses = columns
      .filter(col => !excludeFromUpdate.includes(col))
      .map(col => `${col} = VALUES(${col})`); // MySQL uses VALUES() function

    const duplicateKeyClause = updateClauses.length > 0 
      ? `ON DUPLICATE KEY UPDATE ${updateClauses.join(', ')}`
      : '';

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ${duplicateKeyClause}
    `;

    return this.connection.query(query, values);
  }

  /**
   * MySQL-specific decrement support count using GREATEST function
   */
  async decrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `UPDATE wishes SET support_count = GREATEST(support_count - 1, 0) WHERE id = ?`;
    return this.connection.query(query, [wishId]);
  }

  /**
   * MySQL-specific atomic support count update
   * MySQL requires the parameter twice for the subquery and WHERE clause
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