import { DatabaseConnection, DatabaseResult, DatabaseValue } from "../DatabaseConnection";
import { QueryExecutor, SelectOptions, JoinQueryConfig } from "./QueryExecutor";
import { QueryPlaceholderStrategy } from "./QueryPlaceholderStrategy";
import { Logger } from "../../../utils/Logger";

/**
 * Base implementation of QueryExecutor using Template Method pattern
 * 
 * This class contains all the common query building logic while allowing
 * database-specific implementations through the placeholder strategy.
 * 
 * Benefits:
 * - Eliminates ~486 lines of duplicated code across 3 query executors
 * - Centralizes query building logic for consistency
 * - Makes adding new database dialects much easier
 * - Provides consistent performance monitoring and error handling
 */
export abstract class BaseQueryExecutor implements QueryExecutor {
  protected constructor(
    protected connection: DatabaseConnection,
    protected placeholderStrategy: QueryPlaceholderStrategy
  ) {}

  /**
   * Performance monitoring wrapper for database operations
   */
  private async measurePerformance<T>(
    operation: string,
    queryPromise: Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await queryPromise;
      const duration = Date.now() - startTime;
      
      if (duration > 100) {
        Logger.warn(`[${this.placeholderStrategy.getDialectName()}] Slow query detected`, {
          operation,
          duration: `${duration}ms`
        });
      } else {
        Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Query completed`, {
          operation,
          duration: `${duration}ms`
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error(`[${this.placeholderStrategy.getDialectName()}] Query failed`, {
        operation,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      } as any);
      throw error;
    }
  }

  async insert(table: string, data: Record<string, any>): Promise<DatabaseResult> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => 
      this.placeholderStrategy.getPlaceholder(i + 1)
    );

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing insert`, {
      table,
      columns: columns.length
    });

    return this.measurePerformance(
      `INSERT INTO ${table}`,
      this.connection.query(query, values)
    );
  }

  async select(table: string, options: SelectOptions = {}): Promise<DatabaseResult> {
    const columns = options.columns ? options.columns.join(', ') : '*';
    let query = `SELECT ${columns} FROM ${table}`;
    const params: DatabaseValue[] = [];
    let paramIndex = 1;

    // WHERE clause
    if (options.where) {
      const whereConditions = Object.entries(options.where).map(([key, value]) => {
        params.push(value);
        return `${key} = ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
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
      query += ` LIMIT ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
      params.push(options.limit);
    }

    // OFFSET clause
    if (options.offset !== undefined) {
      query += ` OFFSET ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
      params.push(options.offset);
    }

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing select`, {
      table,
      whereConditions: options.where ? Object.keys(options.where).length : 0,
      hasOrderBy: !!options.orderBy?.length,
      hasLimit: options.limit !== undefined,
      hasOffset: options.offset !== undefined
    });

    return this.measurePerformance(
      `SELECT FROM ${table}`,
      this.connection.query(query, params)
    );
  }

  async update(table: string, data: Record<string, any>, conditions: Record<string, any>): Promise<DatabaseResult> {
    const updates = Object.keys(data);
    const values = Object.values(data);
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    let paramIndex = 1;
    
    // Build SET clause
    const setClauses = updates.map(column => 
      `${column} = ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`
    );
    
    // Build WHERE clause
    const whereConditions = conditionKeys.map(key => 
      `${key} = ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`
    );

    const query = `
      UPDATE ${table}
      SET ${setClauses.join(', ')}
      WHERE ${whereConditions.join(' AND ')}
    `;

    const allParams = [...values, ...conditionValues];

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing update`, {
      table,
      updatedColumns: updates.length,
      whereConditions: conditionKeys.length
    });

    return this.measurePerformance(
      `UPDATE ${table}`,
      this.connection.query(query, allParams)
    );
  }

  async delete(table: string, conditions: Record<string, any>): Promise<DatabaseResult> {
    const conditionKeys = Object.keys(conditions);
    const conditionValues = Object.values(conditions);
    
    const whereConditions = conditionKeys.map((key, i) => 
      `${key} = ${this.placeholderStrategy.getPlaceholder(i + 1)}`
    );

    const query = `DELETE FROM ${table} WHERE ${whereConditions.join(' AND ')}`;

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing delete`, {
      table,
      whereConditions: conditionKeys.length
    });

    return this.measurePerformance(
      `DELETE FROM ${table}`,
      this.connection.query(query, conditionValues)
    );
  }

  /**
   * Abstract method for database-specific upsert implementation
   * Different databases have different UPSERT syntax:
   * - PostgreSQL: ON CONFLICT ... DO UPDATE
   * - MySQL: ON DUPLICATE KEY UPDATE
   * - SQLite: ON CONFLICT ... DO UPDATE
   */
  abstract upsert(table: string, data: Record<string, any>, conflictColumns: string[]): Promise<DatabaseResult>;

  async selectWithJoin(config: JoinQueryConfig): Promise<DatabaseResult> {
    const selectColumns = config.select.join(', ');
    let query = `SELECT ${selectColumns} FROM ${config.mainTable}`;
    
    // Add JOINs
    for (const join of config.joins) {
      query += ` ${join.type} JOIN ${join.table} ON ${join.on}`;
    }
    
    const params: DatabaseValue[] = [];
    let paramIndex = 1;

    // WHERE clause
    if (config.where) {
      const whereConditions = Object.entries(config.where).map(([key, value]) => {
        params.push(value);
        return `${key} = ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
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
        return `${key} = ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
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
      query += ` LIMIT ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
      params.push(config.limit);
    }

    // OFFSET clause
    if (config.offset !== undefined) {
      query += ` OFFSET ${this.placeholderStrategy.getPlaceholder(paramIndex++)}`;
      params.push(config.offset);
    }

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing join query`, {
      mainTable: config.mainTable,
      joins: config.joins.length,
      selectColumns: config.select.length
    });

    return this.measurePerformance(
      `SELECT with ${config.joins.length} JOINs`,
      this.connection.query(query, params)
    );
  }

  /**
   * Domain-specific support count operations
   */
  async incrementSupportCount(wishId: string): Promise<DatabaseResult> {
    const query = `
      UPDATE wishes 
      SET support_count = support_count + 1 
      WHERE id = ${this.placeholderStrategy.getPlaceholder(1)}
    `;

    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Incrementing support count`, {
      wishId: wishId.substring(0, 8) + '...'
    });

    return this.measurePerformance(
      'INCREMENT support_count',
      this.connection.query(query, [wishId])
    );
  }

  /**
   * Abstract method for database-specific decrement support count
   * Different databases use different functions:
   * - PostgreSQL: GREATEST(support_count - 1, 0)
   * - MySQL: GREATEST(support_count - 1, 0)
   * - SQLite: MAX(support_count - 1, 0)
   */
  abstract decrementSupportCount(wishId: string): Promise<DatabaseResult>;

  /**
   * Abstract method for database-specific support count updates
   * PostgreSQL and SQLite use different approaches for atomic updates
   */
  abstract updateSupportCount(wishId: string): Promise<DatabaseResult>;

  async raw(query: string, params: DatabaseValue[]): Promise<DatabaseResult> {
    Logger.debug(`[${this.placeholderStrategy.getDialectName()}] Executing raw query`, {
      queryLength: query.length,
      paramCount: params.length
    });

    return this.measurePerformance(
      'RAW QUERY',
      this.connection.query(query, params)
    );
  }
}