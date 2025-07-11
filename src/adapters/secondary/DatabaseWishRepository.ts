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
    console.log("Saving wish:", wish);
    console.log("User ID:", userId);
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

    // デバッグ用ロギング
    console.log("Row from database:", row);
    console.log("created_at value:", row.created_at);
    console.log("created_at type:", typeof row.created_at);

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
        console.warn(`Invalid date value: ${dateValue}, using current date`);
        return new Date(); // 無効な日付の場合は現在時刻を使用
      }

      return parsedDate;
    } catch (error) {
      console.error(`Error parsing date: ${dateValue}`, error);
      return new Date(); // エラーが発生した場合は現在時刻を使用
    }
  }

  async addSupport(wishId: string, sessionId?: string, userId?: number): Promise<void> {
    try {
      console.log("Adding support for wishId:", wishId, "sessionId:", sessionId, "userId:", userId);
      
      // 既に応援済みかチェック
      const exists = await this.hasSupported(wishId, sessionId, userId);
      if (exists) {
        console.log("Support already exists, skipping insert");
        return;
      }
      
      // 応援記録を挿入
      const insertSupportQuery = `
        INSERT INTO supports (wish_id, session_id, user_id)
        VALUES ($1, $2, $3)
      `;
      const insertResult = await this.db.query(insertSupportQuery, [wishId, sessionId || null, userId || null]);
      console.log("Insert support result:", insertResult);

      // 応援数を取得
      const countResult = await this.db.query(`
        SELECT COUNT(*) as count FROM supports WHERE wish_id = $1
      `, [wishId]);
      const supportCount = parseInt(countResult.rows[0].count);
      console.log("Support count from supports table:", supportCount);

      // 応援数を更新
      const updateCountQuery = `
        UPDATE wishes 
        SET support_count = $1
        WHERE id = $2
      `;
      const updateResult = await this.db.query(updateCountQuery, [supportCount, wishId]);
      console.log("Update count result:", updateResult);

      // 更新後のカウントを確認
      const finalCountQuery = `SELECT support_count FROM wishes WHERE id = $1`;
      const finalCountResult = await this.db.query(finalCountQuery, [wishId]);
      console.log("Current support count:", finalCountResult.rows[0]?.support_count);

    } catch (error) {
      console.error("Error adding support:", error);
      throw error;
    }
  }

  async removeSupport(wishId: string, sessionId?: string, userId?: number): Promise<void> {
    try {
      console.log("Removing support for wishId:", wishId, "sessionId:", sessionId, "userId:", userId);
      
      // 応援記録を削除
      let deleteSupportQuery = `
        DELETE FROM supports 
        WHERE wish_id = $1
      `;
      const params: any[] = [wishId];
      
      if (userId) {
        deleteSupportQuery += " AND user_id = $2";
        params.push(userId);
      } else if (sessionId) {
        deleteSupportQuery += " AND session_id = $2";
        params.push(sessionId);
      }

      const deleteResult = await this.db.query(deleteSupportQuery, params);
      console.log("Delete support result:", deleteResult);

      // 応援数を取得
      const countResult = await this.db.query(`
        SELECT COUNT(*) as count FROM supports WHERE wish_id = $1
      `, [wishId]);
      const supportCount = parseInt(countResult.rows[0].count);
      console.log("Support count from supports table:", supportCount);

      // 応援数を更新
      const updateCountQuery = `
        UPDATE wishes 
        SET support_count = $1
        WHERE id = $2
      `;
      const updateResult = await this.db.query(updateCountQuery, [supportCount, wishId]);
      console.log("Update count result:", updateResult);

      // 更新後のカウントを確認
      const finalCountQuery = `SELECT support_count FROM wishes WHERE id = $1`;
      const finalCountResult = await this.db.query(finalCountQuery, [wishId]);
      console.log("Current support count after removal:", finalCountResult.rows[0]?.support_count);

    } catch (error) {
      console.error("Error removing support:", error);
      throw error;
    }
  }

  async hasSupported(wishId: string, sessionId?: string, userId?: number): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as count
      FROM supports 
      WHERE wish_id = $1
    `;
    const params: any[] = [wishId];
    
    if (userId) {
      query += " AND user_id = $2";
      params.push(userId);
    } else if (sessionId) {
      query += " AND session_id = $2";
      params.push(sessionId);
    }

    console.log("hasSupported query:", query);
    console.log("hasSupported params:", params);

    const result = await this.db.query(query, params);
    const count = parseInt(result.rows[0].count);
    const isSupported = count > 0;
    
    console.log("hasSupported result:", { count, isSupported });
    
    return isSupported;
  }
}
