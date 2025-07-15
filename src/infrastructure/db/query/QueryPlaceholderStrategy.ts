/**
 * Strategy pattern for handling database-specific parameter placeholders
 * 
 * Different databases use different placeholder syntaxes:
 * - PostgreSQL: $1, $2, $3, ...
 * - MySQL: ?, ?, ?, ...
 * - SQLite: ?, ?, ?, ...
 */

export interface QueryPlaceholderStrategy {
  /**
   * Generate parameter placeholder for the given index
   * @param index - The 1-based parameter index
   * @returns The placeholder string for this database dialect
   */
  getPlaceholder(index: number): string;

  /**
   * Get the database dialect name for logging/debugging
   */
  getDialectName(): string;

  /**
   * Check if this dialect supports specific SQL features
   */
  supportsReturning(): boolean;
  supportsUpsert(): boolean;
}

/**
 * PostgreSQL placeholder strategy using $1, $2, $3 format
 */
export class PostgresPlaceholderStrategy implements QueryPlaceholderStrategy {
  getPlaceholder(index: number): string {
    return `$${index}`;
  }

  getDialectName(): string {
    return 'PostgreSQL';
  }

  supportsReturning(): boolean {
    return true;
  }

  supportsUpsert(): boolean {
    return true; // ON CONFLICT
  }
}

/**
 * MySQL placeholder strategy using ? format
 */
export class MySQLPlaceholderStrategy implements QueryPlaceholderStrategy {
  getPlaceholder(index: number): string {
    return '?';
  }

  getDialectName(): string {
    return 'MySQL';
  }

  supportsReturning(): boolean {
    return false; // MySQL doesn't support RETURNING
  }

  supportsUpsert(): boolean {
    return true; // ON DUPLICATE KEY UPDATE
  }
}

/**
 * SQLite placeholder strategy using ? format
 */
export class SQLitePlaceholderStrategy implements QueryPlaceholderStrategy {
  getPlaceholder(index: number): string {
    return '?';
  }

  getDialectName(): string {
    return 'SQLite';
  }

  supportsReturning(): boolean {
    return false; // SQLite doesn't support RETURNING
  }

  supportsUpsert(): boolean {
    return true; // ON CONFLICT
  }
}