import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { DatabaseConnection } from "../../infrastructure/db/DatabaseConnection";
import { Logger } from "../../utils/Logger";

// データベースの行の型定義
interface WishRow {
  id: string;
  name: string | null;
  wish: string;
  created_at: string | Date; // 文字列か日付を許容
  user_id: number | null;
  support_count: number;
  is_supported?: boolean; // 応援状況を追加
}

export class DatabaseWishRepository implements WishRepository {
  constructor(private db: DatabaseConnection) {}

  async save(wish: Wish, userId?: number): Promise<void> {
    const startTime = Date.now();
    // UPSERTクエリ (DBタイプに関わらず、ファクトリで適切に変換される)
    const query = `
      INSERT INTO wishes (id, name, wish, created_at, user_id, support_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) 
      DO UPDATE SET name = $2, wish = $3, user_id = $5, support_count = $6
    `;
    try {
      await this.db.query(query, [
        wish.id,
        wish.name || null,
        wish.wish,
        wish.createdAt,
        userId || null, // ユーザーIDがなければNULL
        wish.supportCount,
      ]);
      const duration = Date.now() - startTime;
      if (duration > 100) {
        Logger.warn(`Slow save operation: ${duration}ms`);
      }
    } catch (error) {
      Logger.error('Error saving wish', error as Error);
      throw error;
    }
  }

  async findByUserId(userId: number): Promise<Wish | null> {
    const result = await this.db.query(
      "SELECT * FROM wishes WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    if (result.rows.length === 0) return null;
    return new Wish({
      id: result.rows[0].id,
      name: result.rows[0].name,
      wish: result.rows[0].wish,
      createdAt: result.rows[0].created_at,
      userId: result.rows[0].user_id,
      supportCount: result.rows[0].support_count || 0,
    });
  }

  async findById(id: string): Promise<Wish | null> {
    const result = await this.db.query("SELECT * FROM wishes WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;
    return new Wish({
      id: row.id,
      name: row.name || undefined,
      wish: row.wish,
      createdAt: this.parseDate(row.created_at),
      userId: row.user_id || undefined, // ユーザーIDがなければundefined
      supportCount: row.support_count || 0,
    });
  }

  async findBySessionId(sessionId: string): Promise<Wish | null> {
    const result = await this.db.query(
      `SELECT w.* 
     FROM wishes w
     JOIN sessions s ON w.id = s.wish_id
     WHERE s.session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;

    // 安全なパース処理を行う
    const createdAt = this.parseDate(row.created_at);

    return new Wish({
      id: row.id,
      name: row.name || undefined,
      wish: row.wish,
      createdAt: createdAt,
      userId: row.user_id || undefined,
      supportCount: row.support_count || 0,
    });
  }

  async findLatest(limit: number, offset: number = 0): Promise<Wish[]> {
    const result = await this.db.query(
      "SELECT * FROM wishes ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    return result.rows.map(
      (row: WishRow) =>
        new Wish({
          id: row.id,
          name: row.name || undefined,
          wish: row.wish,
          createdAt: this.parseDate(row.created_at),
          userId: row.user_id || undefined, // ユーザーIDがなければundefined
          supportCount: row.support_count || 0,
        })
    );
  }

  async findLatestWithSupportStatus(
    limit: number, 
    offset: number = 0, 
    sessionId?: string, 
    userId?: number
  ): Promise<Wish[]> {
    const startTime = Date.now();
    try {
      // LEFT JOINで応援状況を一緒に取得する最適化されたクエリ
      const query = `
        SELECT w.*, 
               CASE 
                 WHEN s.wish_id IS NOT NULL THEN true 
                 ELSE false 
               END as is_supported
        FROM wishes w
        LEFT JOIN supports s ON w.id = s.wish_id 
          AND ((s.user_id IS NOT NULL AND s.user_id = $3) 
               OR (s.session_id IS NOT NULL AND s.session_id = $4))
        ORDER BY w.created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      
      const result = await this.db.query(query, [
        limit, 
        offset, 
        userId || null, 
        sessionId || null
      ]);

      const wishes = result.rows.map((row: WishRow) => 
        new Wish({
          id: row.id,
          name: row.name || undefined,
          wish: row.wish,
          createdAt: this.parseDate(row.created_at),
          userId: row.user_id || undefined,
          supportCount: row.support_count || 0,
          isSupported: row.is_supported || false,
        })
      );

      const duration = Date.now() - startTime;
      if (duration > 100) {
        Logger.warn(`Slow findLatestWithSupportStatus operation: ${duration}ms`);
      }

      return wishes;
    } catch (error) {
      Logger.error('Error finding latest wishes with support status', error as Error);
      throw error;
    }
  }

  // 文字列や日付型をJavaScript Dateオブジェクトに変換するヘルパーメソッド
  private parseDate(dateValue: string | Date): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }

    try {
      // ISO形式の文字列をDateオブジェクトに変換
      const parsedDate = new Date(dateValue);

      // 有効な日付かチェック
      if (isNaN(parsedDate.getTime())) {
        return new Date(); // 無効な日付の場合は現在時刻を使用
      }

      return parsedDate;
    } catch (error) {
      return new Date(); // エラーが発生した場合は現在時刻を使用
    }
  }

  async addSupport(wishId: string, sessionId?: string, userId?: number): Promise<void> {
    const startTime = Date.now();
    try {
      // 既に応援済みかチェック
      const exists = await this.hasSupported(wishId, sessionId, userId);
      if (exists) {
        return; // 既に応援済みの場合は何もしない
      }
      
      // 応援記録を挿入
      const insertQuery = `
        INSERT INTO supports (wish_id, session_id, user_id)
        VALUES ($1, $2, $3)
      `;
      await this.db.query(insertQuery, [wishId, sessionId || null, userId || null]);
      
      // 応援数を更新
      const updateQuery = `
        UPDATE wishes 
        SET support_count = (
          SELECT COUNT(*) FROM supports WHERE wish_id = $1
        )
        WHERE id = $1
      `;
      await this.db.query(updateQuery, [wishId]);
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        Logger.warn(`Slow addSupport operation: ${duration}ms`);
      }
    } catch (error) {
      Logger.error('Error adding support', error as Error);
      throw error;
    }
  }

  async removeSupport(wishId: string, sessionId?: string, userId?: number): Promise<void> {
    const startTime = Date.now();
    try {
      // 応援記録を削除
      const deleteQuery = `
        DELETE FROM supports 
        WHERE wish_id = $1 
          AND ((
            user_id IS NOT NULL AND user_id = $2
          ) OR (
            session_id IS NOT NULL AND session_id = $3
          ))
      `;
      
      const deleteResult = await this.db.query(deleteQuery, [wishId, userId || null, sessionId || null]);
      
      // 応援数を更新
      const updateQuery = `
        UPDATE wishes 
        SET support_count = (
          SELECT COUNT(*) FROM supports WHERE wish_id = $1
        )
        WHERE id = $1
      `;
      const updateResult = await this.db.query(updateQuery, [wishId]);
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        Logger.warn(`Slow removeSupport operation: ${duration}ms`);
      }
    } catch (error) {
      Logger.error('Error removing support', error as Error);
      throw error;
    }
  }

  async hasSupported(wishId: string, sessionId?: string, userId?: number): Promise<boolean> {
    // PostgreSQL用の最適化されたEXISTSクエリ
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM supports 
        WHERE wish_id = $1 
          AND ((
            user_id IS NOT NULL AND user_id = $2
          ) OR (
            session_id IS NOT NULL AND session_id = $3
          ))
      ) as exists
    `;
    
    const result = await this.db.query(query, [wishId, userId || null, sessionId || null]);
    return result.rows[0].exists;
  }
}
