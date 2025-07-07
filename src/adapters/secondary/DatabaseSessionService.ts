import { SessionService } from '../../ports/output/SessionService';
import { DatabaseConnection } from '../../infrastructure/db/DatabaseConnection';
import crypto from 'crypto';

export class DatabaseSessionService implements SessionService {
  constructor(private db: DatabaseConnection) {}

  generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  async linkSessionToWish(sessionId: string, wishId: string): Promise<void> {
    // 日付オブジェクトの代わりにISO文字列を使用
    const currentDate = new Date().toISOString();
    
    await this.db.query(
      'INSERT INTO sessions (session_id, wish_id, created_at) VALUES ($1, $2, $3)',
      [sessionId, wishId, currentDate]
    );
  }

  async getWishIdBySession(sessionId: string): Promise<string | null> {
    const result = await this.db.query(
      'SELECT wish_id FROM sessions WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].wish_id;
  }
}
