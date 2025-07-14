import { DatabaseConnection, DatabaseResult } from "../DatabaseConnection";
import { QueryExecutor, SelectOptions, JoinQueryConfig } from "./QueryExecutor";
import { Logger } from "../../../utils/Logger";

export class PostgresQueryExecutor implements QueryExecutor {
  constructor(private connection: DatabaseConnection) {}

  async insert(table: string, data: Record<string, any>): Promise<DatabaseResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    return this.connection.query(query, values);
  }

  async select(table: string, options: SelectOptions = {}): Promise<DatabaseResult> {
    const columns = options.columns ? options.columns.join(', ') : '*';
    let query = `SELECT ${columns} FROM ${table}`;
    const params: any[] = [];
    let paramIndex = 1;

    // WHERE clause
    if (options.where) {
      const whereConditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `${key} = $${paramIndex++}`;
      });
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // ORDER BY clause
    if (options.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(order => 
        `${order.column} ${order.direction}`
      );
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT clause
    if (options.limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    // OFFSET clause
    if (options.offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    return this.connection.query(query, params);
  }

  async update(table: string, data: Record<string, any>, conditions: Record<string, any>): Promise<DatabaseResult> {
    const updateColumns = Object.keys(data);
    const updateValues = Object.values(data);
    const conditionColumns = Object.keys(conditions);
    const conditionValues = Object.values(conditions);

    let paramIndex = 1;
    const updateClauses = updateColumns.map(col => `${col} = $${paramIndex++}`);
    const whereClauses = conditionColumns.map(col => `${col} = $${paramIndex++}`);

    const query = `
      UPDATE ${table}
      SET ${updateClauses.join(', ')}
      WHERE ${whereClauses.join(' AND ')}
    `;

    const params = [...updateValues, ...conditionValues];
    return this.connection.query(query, params);
  }

  async delete(table: string, conditions: Record<string, any>): Promise<DatabaseResult> {
    const conditionColumns = Object.keys(conditions);
    const conditionValues = Object.values(conditions);

    const whereClauses = conditionColumns.map((col, i) => `${col} = $${i + 1}`);
    const query = `DELETE FROM ${table} WHERE ${whereClauses.join(' AND ')}`;

    return this.connection.query(query, conditionValues);
  }

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

  async selectWithJoin(config: JoinQueryConfig): Promise<DatabaseResult> {
    let query = `SELECT ${config.select.join(', ')} FROM ${config.mainTable}`;
    const params: any[] = [];
    let paramIndex = 1;

    // JOIN clauses
    for (const join of config.joins) {
      query += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
    }

    // WHERE clause
    if (config.where) {
      const whereConditions = Object.entries(config.where).map(([key, value]) => {
        params.push(value);
        return `${key} = $${paramIndex++}`;
      });
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // GROUP BY clause
    if (config.groupBy && config.groupBy.length > 0) {
      query += ` GROUP BY ${config.groupBy.join(', ')}`;
    }

    // HAVING clause
    if (config.having) {
      const havingConditions = Object.entries(config.having).map(([key, value]) => {
        params.push(value);
        return `${key} = $${paramIndex++}`;
      });
      query += ` HAVING ${havingConditions.join(' AND ')}`;
    }

    // ORDER BY clause
    if (config.orderBy && config.orderBy.length > 0) {
      const orderClauses = config.orderBy.map(order => 
        `${order.column} ${order.direction}`
      );
      query += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT clause
    if (config.limit !== undefined) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(config.limit);
    }

    // OFFSET clause
    if (config.offset !== undefined) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(config.offset);
    }

    return this.connection.query(query, params);
  }

  async incrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `
      UPDATE wishes 
      SET support_count = support_count + 1 
      WHERE id = $1
    `;
    return this.connection.query(query, [wishId]);
  }

  async decrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `
      UPDATE wishes 
      SET support_count = GREATEST(support_count - 1, 0) 
      WHERE id = $1
    `;
    return this.connection.query(query, [wishId]);
  }

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

  async raw(query: string, params: any[]): Promise<DatabaseResult> {
    try {
      return this.connection.query(query, params);
    } catch (error) {
      Logger.error('Raw query execution failed', error as Error);
      throw error;
    }
  }
}