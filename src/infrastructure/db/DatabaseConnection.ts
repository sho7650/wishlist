export interface DatabaseRow {
  [key: string]: string | number | boolean | Date | null | undefined;
}

export interface DatabaseResult {
  rows: DatabaseRow[];
  rowCount?: number | null; // null を許容するように変更
}

export type DatabaseValue = string | number | boolean | Date | null;

export interface DatabaseConnection {
  query(text: string, params: DatabaseValue[]): Promise<DatabaseResult>;
  initializeDatabase(): Promise<void>;
  close(): Promise<void>;
}
