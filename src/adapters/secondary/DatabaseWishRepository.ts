import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { DatabaseConnection } from "../../infrastructure/db/DatabaseConnection";

// データベースの行の型定義
interface WishRow {
  id: string;
  name: string | null;
  wish: string;
  created_at: string | Date; // 文字列か日付を許容
}

export class DatabaseWishRepository implements WishRepository {
  constructor(private db: DatabaseConnection) {}

  async save(wish: Wish): Promise<void> {
    // UPSERTクエリ (DBタイプに関わらず、ファクトリで適切に変換される)
    const query = `
      INSERT INTO wishes (id, name, wish, created_at, user_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) 
      DO UPDATE SET name = $2, wish = $3, user_id = $5
    `;
    await this.db.query(query, [
      wish.id,
      wish.name || null,
      wish.wish,
      wish.createdAt,
      wish.userId || null, // ユーザーIDがなければNULL
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
}
