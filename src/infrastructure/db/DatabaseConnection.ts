export interface DatabaseResult {
  rows: any[];
  rowCount?: number | null; // null を許容するように変更
}

export interface DatabaseConnection {
  query(text: string, params: any[]): Promise<DatabaseResult>;
  initializeDatabase(): Promise<void>;
  close(): Promise<void>;
}
