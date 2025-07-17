import { SessionService } from '../../ports/output/SessionService';
import { DatabaseConnection } from '../../infrastructure/db/DatabaseConnection';
import { Logger } from '../../utils/Logger';
import crypto from 'crypto';

export class DatabaseSessionService implements SessionService {
  constructor(private db: DatabaseConnection) {}

  generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  async linkSessionToWish(sessionId: string, wishId: string): Promise<void> {
    // SQLite compatibility: detect parameter syntax
    const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
    const param1 = isSQLite ? '?' : '$1';
    const param2 = isSQLite ? '?' : '$2';
    const param3 = isSQLite ? '?' : '$3';
    
    // 日付オブジェクトの代わりにISO文字列を使用
    const currentDate = new Date().toISOString();
    
    Logger.debug('[SESSION_SERVICE] linkSessionToWish parameters', { sessionId, wishId, currentDate });
    
    await this.db.query(
      `INSERT INTO sessions (session_id, wish_id, created_at) VALUES (${param1}, ${param2}, ${param3})`,
      [sessionId, wishId, currentDate]
    );
  }

  async getWishIdBySession(sessionId: string): Promise<string | null> {
    // SQLite compatibility: detect parameter syntax
    const isSQLite = process.env.DB_TYPE?.toLowerCase() === 'sqlite';
    const param1 = isSQLite ? '?' : '$1';
    
    const result = await this.db.query(
      `SELECT wish_id FROM sessions WHERE session_id = ${param1}`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].wish_id as string;
  }
}
