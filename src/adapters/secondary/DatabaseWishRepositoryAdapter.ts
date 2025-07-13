import { Wish } from "../../domain/entities/Wish";
import { WishId } from "../../domain/value-objects/WishId";
import { WishContent } from "../../domain/value-objects/WishContent";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { SupportCount } from "../../domain/value-objects/SupportCount";
import { WishRepository } from "../../ports/output/WishRepository";
import { DatabaseConnection } from "../../infrastructure/db/DatabaseConnection";
import { Logger } from "../../utils/Logger";

interface WishRow {
  id: string;
  name: string | null;
  wish: string;
  created_at: string | Date;
  user_id: number | null;
  support_count: number;
  is_supported?: boolean;
}

export class DatabaseWishRepositoryAdapter implements WishRepository {
  constructor(private db: DatabaseConnection) {}

  async save(wish: Wish, userId?: number): Promise<void> {
    const startTime = Date.now();
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
        userId || null,
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

  async findById(id: WishId): Promise<Wish | null> {
    const result = await this.db.query("SELECT * FROM wishes WHERE id = $1", [
      id.value,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;
    return await this.mapRowToWish(row);
  }

  async findByUserId(userId: UserId): Promise<Wish | null> {
    const result = await this.db.query(
      "SELECT * FROM wishes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId.value]
    );
    if (result.rows.length === 0) return null;
    return await this.mapRowToWish(result.rows[0] as WishRow);
  }

  async findBySessionId(sessionId: SessionId): Promise<Wish | null> {
    const result = await this.db.query(
      `SELECT w.* 
     FROM wishes w
     JOIN sessions s ON w.id = s.wish_id
     WHERE s.session_id = $1`,
      [sessionId.value]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;
    return await this.mapRowToWish(row);
  }

  async findLatest(limit: number, offset: number = 0): Promise<Wish[]> {
    const result = await this.db.query(
      "SELECT * FROM wishes ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    return Promise.all(result.rows.map(async (row: WishRow) => await this.mapRowToWish(row)));
  }

  async findLatestWithSupportStatus(
    limit: number,
    offset: number = 0,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish[]> {
    // Get latest wishes
    const result = await this.db.query(
      "SELECT * FROM wishes ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    // Map each wish with support status
    const wishesWithStatus = await Promise.all(
      result.rows.map(async (row: WishRow) => {
        const wish = await this.mapRowToWish(row);
        
        // Check if current user/session has supported this wish
        const isSupported = await this.hasSupported(
          WishId.fromString(wish.id), 
          sessionId, 
          userId
        );
        
        // Create a new wish object with support status
        return Wish.fromRepository({
          id: WishId.fromString(wish.id),
          content: WishContent.fromString(wish.wish),
          authorId: wish.authorId,
          name: wish.name,
          supportCount: SupportCount.fromNumber(wish.supportCount),
          supporters: new Set(wish.supporters),
          createdAt: wish.createdAt,
          updatedAt: wish.updatedAt,
          isSupported: isSupported
        });
      })
    );

    return wishesWithStatus;
  }

  async addSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void> {
    Logger.debug('[REPO] Adding support', {
      wishId: wishId.value,
      sessionId: sessionId?.value,
      userId: userId?.value
    });

    // First check if already supported
    const alreadySupported = await this.hasSupported(wishId, sessionId, userId);
    if (alreadySupported) {
      Logger.warn('[REPO] Support already exists, skipping', { wishId: wishId.value });
      return; // Already supported, do nothing
    }

    const query = `
      INSERT INTO supports (wish_id, session_id, user_id, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    
    try {
      const result = await this.db.query(query, [
        wishId.value,
        userId ? null : (sessionId?.value || null), // ログインユーザーの場合はsession_idをnullに
        userId?.value || null
      ]);

      Logger.debug('[REPO] Support inserted', { 
        wishId: wishId.value,
        rowsAffected: result.rowCount 
      });

      // Update support count
      const updateResult = await this.db.query(
        `UPDATE wishes SET support_count = (
          SELECT COUNT(*) FROM supports WHERE wish_id = $1
        ) WHERE id = $1`,
        [wishId.value]
      );

      Logger.debug('[REPO] Support count updated', { 
        wishId: wishId.value,
        rowsUpdated: updateResult.rowCount 
      });
    } catch (error) {
      Logger.error(`[REPO] Error adding support for wish ${wishId.value}`, error as Error);
      
      // If duplicate key error, ignore it (already supported)
      if (error instanceof Error && error.message.includes('duplicate key')) {
        Logger.debug('[REPO] Duplicate key error ignored', { wishId: wishId.value });
        return;
      }
      throw error;
    }
  }

  async removeSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void> {
    Logger.debug('[REPO] Removing support', {
      wishId: wishId.value,
      sessionId: sessionId?.value,
      userId: userId?.value
    });

    let query: string;
    let params: any[];

    if (userId) {
      // Remove by user ID (for logged-in users)
      query = `DELETE FROM supports WHERE wish_id = $1 AND user_id = $2`;
      params = [wishId.value, userId.value];
    } else if (sessionId) {
      // Remove by session ID (for anonymous users)
      query = `DELETE FROM supports WHERE wish_id = $1 AND session_id = $2`;
      params = [wishId.value, sessionId.value];
    } else {
      Logger.warn('[REPO] removeSupport called without userId or sessionId', { wishId: wishId.value });
      return;
    }
    
    const result = await this.db.query(query, params);

    Logger.debug('[REPO] Support removed', { 
      wishId: wishId.value,
      rowsDeleted: result.rowCount,
      queryType: userId ? 'user' : 'session'
    });

    // Update support count
    const updateResult = await this.db.query(
      `UPDATE wishes SET support_count = (
        SELECT COUNT(*) FROM supports WHERE wish_id = $1
      ) WHERE id = $1`,
      [wishId.value]
    );

    Logger.debug('[REPO] Support count updated after removal', { 
      wishId: wishId.value,
      rowsUpdated: updateResult.rowCount 
    });
  }

  async hasSupported(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<boolean> {
    let query: string;
    let params: any[];

    if (userId) {
      // Check by user ID (for logged-in users)
      query = `
        SELECT 1 FROM supports 
        WHERE wish_id = $1 AND user_id = $2
        LIMIT 1
      `;
      params = [wishId.value, userId.value];
    } else if (sessionId) {
      // Check by session ID (for anonymous users)
      query = `
        SELECT 1 FROM supports 
        WHERE wish_id = $1 AND session_id = $2
        LIMIT 1
      `;
      params = [wishId.value, sessionId.value];
    } else {
      // No identifier provided
      Logger.warn('[REPO] hasSupported called without userId or sessionId', { wishId: wishId.value });
      return false;
    }
    
    const result = await this.db.query(query, params);
    const hasSupported = result.rows.length > 0;
    
    Logger.debug('[REPO] Checked support status', {
      wishId: wishId.value,
      sessionId: sessionId?.value,
      userId: userId?.value,
      hasSupported,
      rowsFound: result.rows.length,
      queryType: userId ? 'user' : 'session'
    });

    return hasSupported;
  }

  private async mapRowToWish(row: WishRow): Promise<Wish> {
    // Get session ID from sessions table for anonymous users
    let authorId: UserId | SessionId;
    
    if (row.user_id) {
      authorId = UserId.fromNumber(row.user_id);
    } else {
      // Get actual session ID from sessions table
      const sessionResult = await this.db.query(
        'SELECT session_id FROM sessions WHERE wish_id = $1 LIMIT 1',
        [row.id]
      );
      const sessionId = sessionResult.rows.length > 0 
        ? sessionResult.rows[0].session_id 
        : `session_${row.id}`;
      authorId = SessionId.fromString(sessionId);
    }

    // Get supporters list
    const supportersResult = await this.db.query(
      'SELECT session_id, user_id FROM supports WHERE wish_id = $1',
      [row.id]
    );
    
    const supporters = new Set<string>();
    supportersResult.rows.forEach((support: any) => {
      if (support.user_id) {
        supporters.add(`user_${support.user_id}`);
      } else if (support.session_id) {
        supporters.add(`session_${support.session_id}`);
      }
    });

    return Wish.fromRepository({
      id: WishId.fromString(row.id),
      content: WishContent.fromString(row.wish),
      authorId,
      name: row.name || undefined,
      supportCount: SupportCount.fromNumber(row.support_count || 0),
      supporters,
      createdAt: this.parseDate(row.created_at),
      isSupported: row.is_supported
    });
  }

  private parseDate(dateValue: string | Date): Date {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (typeof dateValue === 'string') {
      return new Date(dateValue);
    }
    return new Date();
  }
}