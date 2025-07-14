import { Wish } from "../../domain/entities/Wish";
import { WishId } from "../../domain/value-objects/WishId";
import { WishContent } from "../../domain/value-objects/WishContent";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { SupportCount } from "../../domain/value-objects/SupportCount";
import { WishRepository } from "../../ports/output/WishRepository";
import { QueryExecutor } from "../../infrastructure/db/query/QueryExecutor";
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
  constructor(private queryExecutor: QueryExecutor) {}

  async save(wish: Wish, userId?: number): Promise<void> {
    const startTime = Date.now();
    try {
      const wishData = {
        id: wish.id,
        name: wish.name || null,
        wish: wish.wish,
        created_at: wish.createdAt ? wish.createdAt.toISOString() : new Date().toISOString(),
        user_id: userId || null,
        support_count: wish.supportCount,
      };
      
      // Debug logging for SQLite
      Logger.debug('[REPO] Saving wish data:', {
        id: wishData.id,
        name: wishData.name,
        wish: wishData.wish?.substring(0, 50),
        created_at: wishData.created_at,
        created_at_type: typeof wishData.created_at,
        user_id: wishData.user_id,
        support_count: wishData.support_count
      });
      
      await this.queryExecutor.upsert('wishes', wishData, ['id']);
      
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
    const result = await this.queryExecutor.select('wishes', {
      where: { id: id.value }
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;
    return await this.mapRowToWish(row);
  }

  async findByUserId(userId: UserId): Promise<Wish | null> {
    const result = await this.queryExecutor.select('wishes', {
      where: { user_id: userId.value },
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit: 1
    });
    if (result.rows.length === 0) return null;
    return await this.mapRowToWish(result.rows[0] as WishRow);
  }

  async findBySessionId(sessionId: SessionId): Promise<Wish | null> {
    const result = await this.queryExecutor.selectWithJoin({
      mainTable: 'wishes',
      joins: [
        { table: 'sessions', on: 'wishes.id = sessions.wish_id', type: 'INNER' }
      ],
      select: ['wishes.*'],
      where: { 'sessions.session_id': sessionId.value }
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as WishRow;
    return await this.mapRowToWish(row);
  }

  async findLatest(limit: number, offset: number = 0): Promise<Wish[]> {
    const result = await this.queryExecutor.select('wishes', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit,
      offset
    });

    return Promise.all(result.rows.map(async (row: WishRow) => await this.mapRowToWish(row)));
  }

  async findLatestWithSupportStatus(
    limit: number,
    offset: number = 0,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish[]> {
    // Get latest wishes
    const result = await this.queryExecutor.select('wishes', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit,
      offset
    });

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

    try {
      const result = await this.queryExecutor.insert('supports', {
        wish_id: wishId.value,
        session_id: userId ? null : (sessionId?.value ?? null), // ログインユーザーの場合はsession_idをnullに
        user_id: userId?.value ?? null,
        created_at: new Date().toISOString()
      });

      Logger.debug('[REPO] Support inserted', { 
        wishId: wishId.value,
        rowsAffected: result.rowCount 
      });

      // Update support count
      const updateResult = await this.queryExecutor.updateSupportCount(wishId.value);

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

    let result;
    if (userId) {
      // Remove by user ID (for logged-in users)
      result = await this.queryExecutor.delete('supports', {
        wish_id: wishId.value,
        user_id: userId.value
      });
    } else if (sessionId) {
      // Remove by session ID (for anonymous users)
      result = await this.queryExecutor.delete('supports', {
        wish_id: wishId.value,
        session_id: sessionId.value
      });
    } else {
      Logger.warn('[REPO] removeSupport called without userId or sessionId', { wishId: wishId.value });
      return;
    }

    Logger.debug('[REPO] Support removed', { 
      wishId: wishId.value,
      rowsDeleted: result.rowCount,
      queryType: userId ? 'user' : 'session'
    });

    // Update support count
    const updateResult = await this.queryExecutor.updateSupportCount(wishId.value);

    Logger.debug('[REPO] Support count updated after removal', { 
      wishId: wishId.value,
      rowsUpdated: updateResult.rowCount 
    });
  }

  async hasSupported(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<boolean> {
    let result;

    if (userId) {
      // Check by user ID (for logged-in users)
      result = await this.queryExecutor.select('supports', {
        columns: ['1'],
        where: {
          wish_id: wishId.value,
          user_id: userId.value
        },
        limit: 1
      });
    } else if (sessionId) {
      // Check by session ID (for anonymous users)
      result = await this.queryExecutor.select('supports', {
        columns: ['1'],
        where: {
          wish_id: wishId.value,
          session_id: sessionId.value
        },
        limit: 1
      });
    } else {
      // No identifier provided
      Logger.warn('[REPO] hasSupported called without userId or sessionId', { wishId: wishId.value });
      return false;
    }
    
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
      const sessionResult = await this.queryExecutor.select('sessions', {
        columns: ['session_id'],
        where: { wish_id: row.id },
        limit: 1
      });
      const sessionId = sessionResult.rows.length > 0 
        ? sessionResult.rows[0].session_id 
        : `session_${row.id}`;
      authorId = SessionId.fromString(sessionId);
    }

    // Get supporters list
    const supportersResult = await this.queryExecutor.select('supports', {
      columns: ['session_id', 'user_id'],
      where: { wish_id: row.id }
    });
    
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