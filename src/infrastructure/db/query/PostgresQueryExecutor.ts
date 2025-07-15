import { DatabaseConnection, DatabaseResult } from "../DatabaseConnection";
import { BaseQueryExecutor } from "./BaseQueryExecutor";
import { PostgresPlaceholderStrategy } from "./QueryPlaceholderStrategy";

/**
 * PostgreSQL-specific QueryExecutor implementation
 * 
 * This class now extends BaseQueryExecutor, eliminating ~90% of duplicate code.
 * Only PostgreSQL-specific features like UPSERT and support count updates are implemented here.
 */
export class PostgresQueryExecutor extends BaseQueryExecutor {
  constructor(connection: DatabaseConnection) {
    super(connection, new PostgresPlaceholderStrategy());
  }

  /**
   * PostgreSQL-specific UPSERT using ON CONFLICT syntax
   */
  async upsert(table: string, data: Record<string, any>, conflictColumns: string[]): Promise<DatabaseResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    // PostgreSQL specific ON CONFLICT syntax
    // Exclude conflict columns and timestamp fields that shouldn't be updated
    const excludeFromUpdate = [...conflictColumns, 'created_at'];
    const updateClauses = columns
      .filter(col => !excludeFromUpdate.includes(col))
      .map(col => `${col} = EXCLUDED.${col}`);

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
   * PostgreSQL-specific decrement support count using GREATEST function
   */
  async decrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `UPDATE wishes SET support_count = GREATEST(support_count - 1, 0) WHERE id = $1`;
    return this.connection.query(query, [wishId]);
  }

  /**
   * PostgreSQL-specific atomic support count update using CTE
   */
  async updateSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `
      UPDATE wishes 
      SET support_count = (
        SELECT COUNT(*) FROM supports WHERE wish_id = $1
      ) 
      WHERE id = $1
    `;
    return this.connection.query(query, [wishId]);
  }
}