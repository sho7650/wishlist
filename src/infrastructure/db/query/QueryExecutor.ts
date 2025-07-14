import { DatabaseResult } from "../DatabaseConnection";

export interface QueryExecutor {
  // Basic CRUD operations
  insert(table: string, data: Record<string, any>): Promise<DatabaseResult>;
  select(table: string, options?: SelectOptions): Promise<DatabaseResult>;
  update(table: string, data: Record<string, any>, conditions: Record<string, any>): Promise<DatabaseResult>;
  delete(table: string, conditions: Record<string, any>): Promise<DatabaseResult>;
  
  // Advanced operations
  upsert(table: string, data: Record<string, any>, conflictColumns: string[]): Promise<DatabaseResult>;
  selectWithJoin(config: JoinQueryConfig): Promise<DatabaseResult>;
  
  // Support count operations (specific to this domain)
  incrementSupportCount(wishId: string): Promise<DatabaseResult>;
  decrementSupportCount(wishId: string): Promise<DatabaseResult>;
  updateSupportCount(wishId: string): Promise<DatabaseResult>;
  
  // Raw query for complex cases
  raw(query: string, params: any[]): Promise<DatabaseResult>;
}

export interface SelectOptions {
  where?: Record<string, any>;
  orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
  columns?: string[];
}

export interface JoinQueryConfig {
  mainTable: string;
  joins: Array<{
    table: string;
    on: string;
    type: 'LEFT' | 'INNER' | 'RIGHT';
  }>;
  select: string[];
  where?: Record<string, any>;
  orderBy?: Array<{ column: string; direction: 'ASC' | 'DESC' }>;
  limit?: number;
  offset?: number;
  groupBy?: string[];
  having?: Record<string, any>;
}