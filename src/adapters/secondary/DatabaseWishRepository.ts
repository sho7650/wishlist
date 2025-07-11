import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { DatabaseConnection } from "../../infrastructure/db/DatabaseConnection";

// データベースの行の型定義
interface WishRow {
  id: string;
  name: string | null;
  wish: string;
  created_at: string | Date; // 文字列か日付を許容
  user_id: number | null;
  support_count: number;
}

export class DatabaseWishRepository implements WishRepository {
  constructor(private db: DatabaseConnection) {}

  async save(wish: Wish, userId?: number): Promise<void> {
    // UPSERTクエリ (DBタイプに関わらず、ファクトリで適切に変換される)
    const query = `
      INSERT INTO wishes (id, name, wish, created_at, user_id, support_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) 
      DO UPDATE SET name = $2, wish = $3, user_id = $5, support_count = $6
    `;
    await this.db.query(query, [
      wish.id,
      wish.name || null,
      wish.wish,
      wish.createdAt,
      userId || null, // ユーザーIDがなければNULL
      wish.supportCount,
    ]);
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
  }

  async removeSupport(wishId: string, sessionId?: string, userId?: number): Promise<void> {
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
