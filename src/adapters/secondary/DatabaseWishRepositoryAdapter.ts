import { Wish } from "../../domain/entities/Wish";
import { WishId } from "../../domain/value-objects/WishId";
import { WishContent } from "../../domain/value-objects/WishContent";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { SupportCount } from "../../domain/value-objects/SupportCount";
import { WishRepository } from "../../ports/output/WishRepository";
import { QueryExecutor } from "../../infrastructure/db/query/QueryExecutor";
import { Logger } from "../../utils/Logger";
import { DatabaseRow } from "../../infrastructure/db/DatabaseConnection";

interface WishRow extends DatabaseRow {
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

    const row = this.mapDatabaseRowToWishRow(result.rows[0]);
    return await this.mapRowToWish(row);
  }

  private mapDatabaseRowToWishRow(row: DatabaseRow): WishRow {
    return {
      id: row.id as string,
      name: row.name as string | null,
      wish: row.wish as string,
      created_at: row.created_at as string | Date,
      user_id: row.user_id as number | null,
      support_count: row.support_count as number,
      is_supported: row.is_supported as boolean | undefined
    };
  }

  async findByUserId(userId: UserId): Promise<Wish | null> {
    const result = await this.queryExecutor.select('wishes', {
      where: { user_id: userId.value },
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit: 1
    });
    if (result.rows.length === 0) return null;
    return await this.mapRowToWish(this.mapDatabaseRowToWishRow(result.rows[0]));
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

    const row = this.mapDatabaseRowToWishRow(result.rows[0]);
    return await this.mapRowToWish(row);
  }

  async findLatest(limit: number, offset: number = 0): Promise<Wish[]> {
    const result = await this.queryExecutor.select('wishes', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit,
      offset
    });

    return Promise.all(result.rows.map(async (row) => await this.mapRowToWish(this.mapDatabaseRowToWishRow(row))));
  }

  async findLatestWithSupportStatus(
    limit: number,
    offset: number = 0,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish[]> {
    // Use optimized batch loading for better performance
    return this.findLatestWithSupportStatusOptimized(limit, offset, sessionId, userId);
  }

  private async findLatestWithSupportStatusOptimized(
    limit: number,
    offset: number = 0,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish[]> {
    // Main query with LEFT JOIN to get support status in single query
    const viewerSessionId = sessionId?.value;
    const viewerUserId = userId?.value;

    const mainQuery = `
      SELECT 
        w.id, 
        w.name, 
        w.wish, 
        w.created_at, 
        w.user_id, 
        w.support_count,
        CASE 
          WHEN vs.wish_id IS NOT NULL THEN true 
          ELSE false 
        END as is_supported_by_viewer
      FROM wishes w
      LEFT JOIN supports vs ON (
        w.id = vs.wish_id AND (
          ($1::text IS NOT NULL AND vs.session_id = $1) OR 
          ($2::integer IS NOT NULL AND vs.user_id = $2)
        )
      )
      ORDER BY w.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const mainResult = await this.queryExecutor.raw(mainQuery, [
      viewerSessionId || null,
      viewerUserId || null,
      limit,
      offset
    ]);

    if (mainResult.rows.length === 0) {
      return [];
    }

    const wishIds = mainResult.rows.map((row: any) => row.id);

    // Batch query for sessions (for anonymous wishes)
    // Convert array to PostgreSQL array format or use IN clause
    const wishIdPlaceholders = wishIds.map((_, index) => `$${index + 1}`).join(', ');
    const sessionQuery = `
      SELECT wish_id, session_id 
      FROM sessions 
      WHERE wish_id IN (${wishIdPlaceholders})
    `;

    const sessionResult = await this.queryExecutor.raw(sessionQuery, wishIds);

    // Batch query for all supporters
    const supportersQuery = `
      SELECT wish_id, session_id, user_id 
      FROM supports 
      WHERE wish_id IN (${wishIdPlaceholders})
    `;

    const supportersResult = await this.queryExecutor.raw(supportersQuery, wishIds);

    // Map results to Wish objects
    return this.mapOptimizedResultsToWishes(
      mainResult.rows,
      sessionResult.rows,
      supportersResult.rows
    );
  }

  private mapOptimizedResultsToWishes(
    mainRows: any[],
    sessionRows: any[],
    supporterRows: any[]
  ): Wish[] {
    const sessionMap = new Map<string, string>();
    sessionRows.forEach((row: any) => {
      sessionMap.set(row.wish_id, row.session_id);
    });

    const supportersMap = new Map<string, Set<string>>();
    supporterRows.forEach((row: any) => {
      const wishId = row.wish_id;
      if (!supportersMap.has(wishId)) {
        supportersMap.set(wishId, new Set());
      }
      
      const supporters = supportersMap.get(wishId)!;
      if (row.user_id) {
        supporters.add(`user_${row.user_id}`);
      } else if (row.session_id) {
        supporters.add(`session_${row.session_id}`);
      }
    });

    return mainRows.map((row: any) => {
      let authorId: UserId | SessionId;
      
      if (row.user_id) {
        authorId = UserId.fromNumber(row.user_id);
      } else {
        const sessionId = sessionMap.get(row.id) || `fallback_${row.id}`;
        authorId = SessionId.fromString(sessionId);
      }

      const supporters = supportersMap.get(row.id) || new Set<string>();

      return Wish.fromRepository({
        id: WishId.fromString(row.id || 'unknown'),
        content: WishContent.fromString(row.wish || ''),
        authorId,
        name: row.name || undefined,
        supportCount: SupportCount.fromNumber(row.support_count || 0),
        supporters,
        createdAt: this.parseDate(row.created_at),
        isSupported: row.is_supported_by_viewer || false
      });
    });
  }

  private async fetchLatestWishRows(limit: number, offset: number): Promise<WishRow[]> {
    const result = await this.queryExecutor.select('wishes', {
      orderBy: [{ column: 'created_at', direction: 'DESC' }],
      limit,
      offset
    });
    return result.rows.map(row => this.mapDatabaseRowToWishRow(row));
  }

  private async mapRowsToWishesWithSupportStatus(
    rows: WishRow[],
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish[]> {
    return Promise.all(
      rows.map(row => this.mapRowToWishWithSupportStatus(row, sessionId, userId))
    );
  }

  private async mapRowToWishWithSupportStatus(
    row: WishRow,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<Wish> {
    const wish = await this.mapRowToWish(row);
    const isSupported = await this.hasSupported(
      WishId.fromString(wish.id),
      sessionId,
      userId
    );

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
  }

  async addSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void> {
    this.logSupportOperation('Adding support', wishId, sessionId, userId);

    if (await this.isAlreadySupported(wishId, sessionId, userId)) {
      return;
    }

    try {
      await this.insertSupportRecord(wishId, sessionId, userId);
      await this.updateSupportCount(wishId);
    } catch (error) {
      this.handleSupportError(error, wishId, 'adding');
    }
  }

  private logSupportOperation(
    operation: string,
    wishId: WishId,
    sessionId?: SessionId,
    userId?: UserId
  ): void {
    Logger.debug(`[REPO] ${operation}`, {
      wishId: wishId.value,
      sessionId: sessionId?.value,
      userId: userId?.value
    });
  }

  private async isAlreadySupported(
    wishId: WishId,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<boolean> {
    const alreadySupported = await this.hasSupported(wishId, sessionId, userId);
    if (alreadySupported) {
      Logger.warn('[REPO] Support already exists, skipping', { wishId: wishId.value });
      return true;
    }
    return false;
  }

  private async insertSupportRecord(
    wishId: WishId,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<void> {
    const result = await this.queryExecutor.insert('supports', {
      wish_id: wishId.value,
      session_id: userId ? null : (sessionId?.value ?? null),
      user_id: userId?.value ?? null,
      created_at: new Date().toISOString()
    });

    Logger.debug('[REPO] Support inserted', {
      wishId: wishId.value,
      rowsAffected: result.rowCount
    });
  }

  private async updateSupportCount(wishId: WishId): Promise<void> {
    const updateResult = await this.queryExecutor.updateSupportCount(wishId.value);
    Logger.debug('[REPO] Support count updated', {
      wishId: wishId.value,
      rowsUpdated: updateResult.rowCount
    });
  }

  private handleSupportError(error: unknown, wishId: WishId, operation: string): void {
    Logger.error(`[REPO] Error ${operation} support for wish ${wishId.value}`, error as Error);
    
    if (error instanceof Error && error.message.includes('duplicate key')) {
      Logger.debug('[REPO] Duplicate key error ignored', { wishId: wishId.value });
      return;
    }
    throw error;
  }

  async removeSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void> {
    this.logSupportOperation('Removing support', wishId, sessionId, userId);

    const result = await this.deleteSupportRecord(wishId, sessionId, userId);
    if (result) {
      await this.updateSupportCount(wishId);
    }
  }

  private async deleteSupportRecord(
    wishId: WishId,
    sessionId?: SessionId,
    userId?: UserId
  ): Promise<boolean> {
    if (!userId && !sessionId) {
      Logger.warn('[REPO] removeSupport called without userId or sessionId', { wishId: wishId.value });
      return false;
    }

    const result = userId
      ? await this.queryExecutor.delete('supports', {
          wish_id: wishId.value,
          user_id: userId.value
        })
      : await this.queryExecutor.delete('supports', {
          wish_id: wishId.value,
          session_id: sessionId!.value
        });

    Logger.debug('[REPO] Support removed', {
      wishId: wishId.value,
      rowsDeleted: result.rowCount,
      queryType: userId ? 'user' : 'session'
    });

    return (result.rowCount ?? 0) > 0;
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
        ? sessionResult.rows[0].session_id as string
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