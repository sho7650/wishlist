# Claude Code ソフトウェアアーキテクチャ原則 - トラブルシューティング

## 概要

本ドキュメントでは、Claude Code を使用した開発プロジェクトで発生する可能性のある問題とその解決策を提示します。

## よくある設計問題と解決策

### 1. ドメインロジックの散在

#### 問題の症状

```typescript
// ❌ 問題のあるコード：ビジネスロジックがController層に散在
export class WishController {
  async addSupport(req: Request, res: Response): Promise<void> {
    const wishId = req.params.wishId;
    const userId = req.user?.id;
    const sessionId = req.session.id;

    // ❌ ビジネスルールがController層に
    if (userId && userId === wishAuthorId) {
      return res.status(400).json({ error: "自分の願いには応援できません" });
    }

    // ❌ 重複チェックもController層で
    const existingSupport = await this.db.query(
      "SELECT * FROM supports WHERE wish_id = ? AND supporter_id = ?",
      [wishId, userId || sessionId]
    );

    if (existingSupport.length > 0) {
      return res.status(400).json({ error: "既に応援済みです" });
    }

    // データベース操作
  }
}
```

#### 解決策

```typescript
// ✅ 解決策：ビジネスロジックをドメイン層に移動
export class WishController {
  constructor(private readonly wishService: WishService) {}

  async addSupport(req: Request, res: Response): Promise<void> {
    try {
      const wishId = WishId.fromString(req.params.wishId);
      const supporter = SessionManager.getViewer(req);

      // ビジネスロジックはドメイン層で処理
      await this.wishService.addSupport(wishId, supporter);

      res.status(201).json({ success: true });
    } catch (error) {
      this.handleDomainError(error, res);
    }
  }
}

export class WishService {
  async addSupport(
    wishId: WishId,
    supporter: UserId | SessionId
  ): Promise<void> {
    const wish = await this.wishRepository.findById(wishId);
    if (!wish) {
      throw new DomainException("Wish not found", "WISH_NOT_FOUND");
    }

    // ✅ ビジネスルールはエンティティで検証
    wish.addSupport(supporter);

    await this.wishRepository.save(wish);

    // ドメインイベントの発行
    const events = wish.getDomainEvents();
    events.forEach((event) => this.eventBus.publish(event));
    wish.clearDomainEvents();
  }
}
```

#### Claude Code 協働プロンプト

```typescript
const REFACTORING_PROMPT = `
Context: Wishlist アプリケーションでドメインロジックがController層に散在している問題

Problem: 
- ビジネスルールがController層にハードコーディング
- 同じバリデーションロジックが複数箇所に重複
- テストが困難

Goal: DDD原則に従い、ビジネスロジックをドメイン層に移動

Requirements:
1. Wish エンティティにビジネスルール実装
2. Controller は薄いレイヤーとして保持
3. 既存APIインターフェースの互換性維持
4. 包括的なユニットテスト追加

Expected Output:
1. リファクタリングされたWishエンティティ
2. 簡素化されたController
3. ドメインサービスの設計
4. エンティティ用ユニットテスト

ステップバイステップで実装してください。
`;
```

### 2. N+1 クエリ問題の診断と解決

#### 問題の診断

```typescript
// 問題の診断：N+1クエリ検出器
export class N1QueryDetector {
  private queryCount = 0;
  private similarQueries: Map<string, number> = new Map();

  detectN1Pattern(query: string): void {
    this.queryCount++;

    // クエリパターンの正規化（パラメータを除去）
    const normalizedQuery = query
      .replace(/\$\d+/g, "?")
      .replace(/\s+/g, " ")
      .trim();

    const count = this.similarQueries.get(normalizedQuery) || 0;
    this.similarQueries.set(normalizedQuery, count + 1);

    // N+1パターンの検出
    if (count > 5) {
      // 同じパターンが5回以上
      console.warn("Potential N+1 query detected:", {
        pattern: normalizedQuery,
        occurrences: count + 1,
        totalQueries: this.queryCount,
      });
    }
  }
}
```

#### 解決策：バッチローディング

```typescript
export class OptimizedWishRepository {
  // ❌ N+1クエリが発生するコード
  async findWishesWithSupportInfo_BAD(
    wishIds: WishId[]
  ): Promise<WishWithSupportInfo[]> {
    const wishes: WishWithSupportInfo[] = [];

    for (const wishId of wishIds) {
      const wish = await this.findById(wishId);
      // ❌ 各願いに対して個別にクエリが実行される
      const supportCount = await this.getSupportCount(wishId);
      const isSupported = await this.checkIfSupported(wishId, viewer);

      wishes.push(new WishWithSupportInfo(wish, supportCount, isSupported));
    }

    return wishes;
  }

  // ✅ バッチローディングで解決
  async findWishesWithSupportInfo_GOOD(
    wishIds: WishId[],
    viewer: UserId | SessionId
  ): Promise<WishWithSupportInfo[]> {
    if (wishIds.length === 0) return [];

    // 単一のJOINクエリで全データを取得
    const query = `
      SELECT 
        w.*,
        COALESCE(sc.support_count, 0) as support_count,
        CASE WHEN vs.supporter_id IS NOT NULL THEN true ELSE false END as is_supported
      FROM wishes w
      LEFT JOIN (
        SELECT wish_id, COUNT(*) as support_count
        FROM wish_supports
        WHERE wish_id = ANY($1)
        GROUP BY wish_id
      ) sc ON w.id = sc.wish_id
      LEFT JOIN wish_supports vs ON (
        w.id = vs.wish_id 
        AND vs.supporter_id = $2 
        AND vs.supporter_type = $3
      )
      WHERE w.id = ANY($1)
    `;

    const result = await this.pool.query(query, [
      wishIds.map((id) => id.value),
      viewer.value,
      viewer.type,
    ]);

    return result.rows.map((row) => this.mapToWishWithSupportInfo(row));
  }
}
```

#### Claude Code 協働プロンプト

```typescript
const N1_OPTIMIZATION_PROMPT = `
Context: Wishlist アプリケーションでN+1クエリ問題が発生

Problem:
- 願い一覧取得時に各願いの応援情報を個別取得
- 20件の願い表示で21回のクエリが実行される
- レスポンス時間が500ms超過

Current Implementation:
[問題のあるコードを貼り付け]

Goal: 単一のJOINクエリで全情報を取得

Requirements:
1. PostgreSQL の最適化クエリ使用
2. TypeScript の型安全性維持
3. レスポンス時間 < 200ms達成
4. 既存のWishWithSupportInfo DTOとの互換性

Expected Output:
1. 最適化されたクエリ実装
2. パフォーマンステスト結果
3. インデックス設計提案
4. ベンチマーク比較

パフォーマンス改善の効果測定も含めてください。
`;
```

### 3. AI 協調でのコミュニケーション改善

#### 問題のある曖昧なプロンプト

```typescript
// 問題：曖昧なプロンプトによる低品質なコード生成
const POOR_PROMPT = `
応援機能を作って
`;
```

#### 解決策：構造化された明確なプロンプト

```typescript
// 解決策：構造化された明確なプロンプト
const IMPROVED_PROMPT = `
## Context
Wishlist アプリケーションの応援機能実装

## Current State
- Wish エンティティは基本機能のみ実装済み
- PostgreSQL + TypeScript + Express 環境
- DDD アーキテクチャ採用

## Requirements
### Functional Requirements
1. ユーザーは他のユーザーの願いに応援できる
2. 同じ願いに対して1ユーザー1応援まで
3. 匿名ユーザー（セッションベース）も応援可能
4. 応援の取り消し機能
5. リアルタイムでの応援数更新

### Non-Functional Requirements
- API応答時間: 95%ile < 200ms
- 同時接続: 1000ユーザー対応
- 型安全性: 厳格なTypeScript
- テストカバレッジ: 90%以上

## Technical Constraints
- Heroku 環境（PostgreSQL addon使用）
- セッション管理: express-session + connect-pg-simple
- 楽観的UI対応必須

## Expected Deliverables
1. Wish エンティティの拡張
   - addSupport() メソッド
   - removeSupport() メソッド
   - canSupport() 検証メソッド
2. 値オブジェクト
   - SupportCount
   - Supporter型（UserId | SessionId の統合）
3. ドメインイベント
   - WishSupportedEvent
   - WishSupportRemovedEvent
4. Repository 実装
   - N+1クエリ回避
   - バッチ操作対応
5. Controller実装
   - 楽観的更新対応
   - 適切なエラーハンドリング
6. ユニットテスト
   - エンティティのビジネスルール
   - リポジトリの最適化検証

## Implementation Approach
Phase 1: ドメインモデル（エンティティ + 値オブジェクト）
Phase 2: Repository実装（パフォーマンス最適化）
Phase 3: API実装（楽観的UI対応）
Phase 4: テスト実装

各フェーズで段階的に実装し、後方互換性を維持してください。
`;
```

#### プロンプト品質評価ツール

```typescript
// プロンプト品質評価ツール
export class PromptQualityAssessor {
  assessPromptQuality(prompt: string): PromptQualityScore {
    const score = {
      contextClarity: this.assessContextClarity(prompt),
      requirementSpecificity: this.assessRequirementSpecificity(prompt),
      technicalDetail: this.assessTechnicalDetail(prompt),
      deliverableClarity: this.assessDeliverableClarity(prompt),
      implementationGuidance: this.assessImplementationGuidance(prompt),
    };

    const overallScore =
      Object.values(score).reduce((sum, val) => sum + val, 0) / 5;

    return {
      ...score,
      overall: overallScore,
      recommendations: this.generateRecommendations(score),
    };
  }

  private assessContextClarity(prompt: string): number {
    const indicators = [
      "context",
      "current state",
      "background",
      "existing",
      "project",
    ];

    const foundIndicators = indicators.filter((indicator) =>
      prompt.toLowerCase().includes(indicator)
    );

    return Math.min((foundIndicators.length / indicators.length) * 10, 10);
  }

  private generateRecommendations(score: PromptQualityScore): string[] {
    const recommendations: string[] = [];

    if (score.contextClarity < 7) {
      recommendations.push(
        "プロジェクトの背景と現在の状況をより詳しく説明してください"
      );
    }

    if (score.requirementSpecificity < 7) {
      recommendations.push("機能要件と非機能要件を具体的に列挙してください");
    }

    if (score.technicalDetail < 7) {
      recommendations.push(
        "技術スタック、制約、パフォーマンス要件を明記してください"
      );
    }

    return recommendations;
  }
}
```

### 4. 型安全性の問題

#### 問題：any型の多用

```typescript
// ❌ 問題のあるコード
export class ApiResponse {
  constructor(
    public data: any, // any型の使用
    public success: boolean
  ) {}
}

export class WishService {
  async getWishes(): Promise<any[]> { // 戻り値がany
    const wishes = await this.repository.findAll();
    return wishes.map((w: any) => ({ // パラメータもany
      id: w.id,
      content: w.content,
      // 型安全性なし
    }));
  }
}
```

#### 解決策：厳格な型定義

```typescript
// ✅ 解決策：厳格な型定義
export interface ApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly error?: string;
}

export interface WishDTO {
  readonly id: string;
  readonly content: string;
  readonly supportCount: number;
  readonly isSupportedByViewer: boolean;
  readonly createdAt: string;
}

export class WishService {
  async getWishes(viewer: UserId | SessionId): Promise<WishDTO[]> {
    const wishes = await this.repository.findAllWithSupportInfo(viewer);
    
    return wishes.map((wish): WishDTO => ({
      id: wish.id.value,
      content: wish.content.value,
      supportCount: wish.supportCount.value,
      isSupportedByViewer: wish.isSupportedByViewer,
      createdAt: wish.createdAt.toISOString(),
    }));
  }
}

// 型ガード関数
export function isUserId(supporter: UserId | SessionId): supporter is UserId {
  return supporter.type === 'user';
}

// 判別共用体の活用
export type SupportResult = 
  | { success: true; supportCount: number }
  | { success: false; error: string; code: string };
```

### 5. パフォーマンス問題

#### 問題：メモリリークの検出

```typescript
// メモリリークの検出ツール
export class MemoryLeakDetector {
  private initialMemory: NodeJS.MemoryUsage;
  private samples: NodeJS.MemoryUsage[] = [];

  start(): void {
    this.initialMemory = process.memoryUsage();
    
    setInterval(() => {
      const current = process.memoryUsage();
      this.samples.push(current);
      
      // 過去10サンプルでの傾向分析
      if (this.samples.length > 10) {
        this.analyzeMemoryTrend();
        this.samples = this.samples.slice(-10);
      }
    }, 30000); // 30秒間隔
  }

  private analyzeMemoryTrend(): void {
    const recent = this.samples.slice(-5);
    const older = this.samples.slice(0, 5);

    const recentAvg = this.calculateAverage(recent, 'heapUsed');
    const olderAvg = this.calculateAverage(older, 'heapUsed');

    const growthRate = (recentAvg - olderAvg) / olderAvg;

    if (growthRate > 0.1) { // 10%以上の増加
      console.warn('Potential memory leak detected:', {
        growthRate: `${(growthRate * 100).toFixed(2)}%`,
        currentHeap: `${(recentAvg / 1024 / 1024).toFixed(2)}MB`,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

#### 解決策：効率的なリソース管理

```typescript
// ✅ 効率的なリソース管理
export class EfficientWishService {
  private readonly cache = new Map<string, { data: WishDTO; expiry: number }>();
  private readonly maxCacheSize = 1000;

  async getWishes(viewer: UserId | SessionId): Promise<WishDTO[]> {
    const cacheKey = `wishes:${viewer.value}:${viewer.type}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const wishes = await this.repository.findAllWithSupportInfo(viewer);
    const result = wishes.map(this.mapToDTO);

    // キャッシュサイズ制限
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, {
      data: result,
      expiry: Date.now() + 300000, // 5分
    });

    return result;
  }

  private mapToDTO = (wish: WishWithSupportInfo): WishDTO => ({
    id: wish.wish.id.value,
    content: wish.wish.content.value,
    supportCount: wish.wish.supportCount.value,
    isSupportedByViewer: wish.isSupportedByViewer,
    createdAt: wish.wish.createdAt.toISOString(),
  });

  // 定期的なキャッシュクリーンアップ
  startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiry <= now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 1分間隔
  }
}
```

### 6. セッション管理の問題

#### 問題：セッション不整合

```typescript
// ❌ 問題のあるセッション管理
export class BadSessionManager {
  static getUser(req: Request): UserId | SessionId {
    // セッションIDの不整合
    const sessionId = req.session.id || req.sessionID || 'anonymous';
    
    if (req.user) {
      return UserId.fromNumber(req.user.id);
    }
    
    return SessionId.create(sessionId); // 毎回異なるIDが生成される可能性
  }
}
```

#### 解決策：一貫したセッション管理

```typescript
// ✅ 一貫したセッション管理
export class RobustSessionManager {
  private static readonly SESSION_ID_KEY = 'wish_session_id';

  static getOrCreateViewer(req: Request): UserId | SessionId {
    // 認証済みユーザーの場合
    if (req.user?.id) {
      return UserId.fromNumber(req.user.id);
    }

    // セッションIDの確実な取得・生成
    let sessionId = req.session[this.SESSION_ID_KEY];
    
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      req.session[this.SESSION_ID_KEY] = sessionId;
    }

    return SessionId.create(sessionId);
  }

  // セッション検証
  static validateSession(req: Request): boolean {
    if (req.user?.id) {
      return true; // 認証済みユーザー
    }

    const sessionId = req.session[this.SESSION_ID_KEY];
    return Boolean(sessionId && sessionId.length > 0);
  }

  // セッション再生成（セキュリティ向上）
  static regenerateSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          reject(err);
        } else {
          // 新しいセッションIDを設定
          req.session[this.SESSION_ID_KEY] = crypto.randomUUID();
          resolve();
        }
      });
    });
  }
}
```

## エラーハンドリングのベストプラクティス

### 1. 構造化エラーレスポンス

```typescript
// エラーレスポンスの標準化
export interface ErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, any>;
    readonly timestamp: string;
  };
}

export class ErrorHandler {
  static handleError(error: Error, req: Request, res: Response): void {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getErrorCode(error),
        message: this.getErrorMessage(error),
        details: this.getErrorDetails(error),
        timestamp: new Date().toISOString(),
      },
    };

    const statusCode = this.getStatusCode(error);
    
    // エラーログ
    console.error('API Error:', {
      ...errorResponse.error,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      stack: error.stack,
    });

    res.status(statusCode).json(errorResponse);
  }

  private static getErrorCode(error: Error): string {
    if (error instanceof DomainException) {
      return error.code;
    }
    if (error instanceof ValidationError) {
      return 'VALIDATION_ERROR';
    }
    return 'INTERNAL_ERROR';
  }

  private static getStatusCode(error: Error): number {
    if (error instanceof ValidationError) {
      return 400;
    }
    if (error instanceof DomainException) {
      return 422;
    }
    if (error.name === 'NotFoundError') {
      return 404;
    }
    return 500;
  }
}
```

### 2. 回復可能エラーの処理

```typescript
// リトライ機能付きサービス
export class ResilientWishService {
  constructor(
    private readonly repository: WishRepository,
    private readonly maxRetries = 3,
    private readonly retryDelay = 1000
  ) {}

  async createWish(
    content: WishContent,
    author: UserId | SessionId
  ): Promise<Wish> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const wish = Wish.create(WishId.generate(), content, author);
        await this.repository.save(wish);
        return wish;
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === this.maxRetries) {
          throw error;
        }

        // 指数バックオフでリトライ
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        
        console.warn(`Retrying createWish, attempt ${attempt + 1}/${this.maxRetries}`, {
          error: error.message,
          delay,
        });
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: Error): boolean {
    // 一時的なエラーのみリトライ
    return (
      error.name === 'ConnectionError' ||
      error.name === 'TimeoutError' ||
      (error.message && error.message.includes('connection'))
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## デバッグとトレーシング

### 1. 分散トレーシング

```typescript
// リクエストトレーシング
export class RequestTracer {
  private static readonly TRACE_HEADER = 'x-trace-id';

  static middleware(req: Request, res: Response, next: NextFunction): void {
    // トレースIDの生成または継承
    const traceId = req.get(this.TRACE_HEADER) || crypto.randomUUID();
    
    req.traceId = traceId;
    res.setHeader(this.TRACE_HEADER, traceId);

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      console.log('Request completed:', {
        traceId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
      });
    });

    next();
  }

  static trace<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const traceId = crypto.randomUUID();
    const startTime = Date.now();

    console.log('Operation started:', {
      traceId,
      operation,
      context,
    });

    return fn()
      .then((result) => {
        const duration = Date.now() - startTime;
        console.log('Operation completed:', {
          traceId,
          operation,
          duration: `${duration}ms`,
          success: true,
        });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        console.error('Operation failed:', {
          traceId,
          operation,
          duration: `${duration}ms`,
          error: error.message,
          success: false,
        });
        throw error;
      });
  }
}
```

### 2. パフォーマンス監視

```typescript
// リアルタイムパフォーマンス監視
export class PerformanceProfiler {
  private static metrics: Map<string, PerformanceMetric[]> = new Map();

  static profile<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = process.hrtime.bigint();
    const memoryBefore = process.memoryUsage();

    return fn()
      .finally(() => {
        const end = process.hrtime.bigint();
        const memoryAfter = process.memoryUsage();
        
        const metric: PerformanceMetric = {
          operation,
          duration: Number(end - start) / 1_000_000, // ms
          memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
          timestamp: Date.now(),
        };

        this.recordMetric(metric);
        this.analyzePerformance(operation);
      });
  }

  private static recordMetric(metric: PerformanceMetric): void {
    const existing = this.metrics.get(metric.operation) || [];
    existing.push(metric);
    
    // 最新100件のみ保持
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.metrics.set(metric.operation, existing);
  }

  private static analyzePerformance(operation: string): void {
    const metrics = this.metrics.get(operation) || [];
    if (metrics.length < 10) return; // 最低10サンプル必要

    const recent = metrics.slice(-10);
    const avgDuration = recent.reduce((sum, m) => sum + m.duration, 0) / recent.length;
    
    if (avgDuration > 1000) { // 1秒以上
      console.warn('Performance degradation detected:', {
        operation,
        averageDuration: `${avgDuration.toFixed(2)}ms`,
        sampleSize: recent.length,
      });
    }
  }

  static getPerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {};
    
    for (const [operation, metrics] of this.metrics.entries()) {
      const durations = metrics.map(m => m.duration);
      const memoryDeltas = metrics.map(m => m.memoryDelta);
      
      report[operation] = {
        sampleCount: metrics.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        averageMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
      };
    }
    
    return report;
  }
}
```

## 型定義とインターフェース

```typescript
interface PromptQualityScore {
  contextClarity: number;
  requirementSpecificity: number;
  technicalDetail: number;
  deliverableClarity: number;
  implementationGuidance: number;
  overall: number;
  recommendations: string[];
}

interface TechnicalDebtItem {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  description: string;
  estimatedEffort: string;
  impact: 'STABILITY' | 'SECURITY' | 'PERFORMANCE' | 'MAINTAINABILITY' | 'USABILITY';
  priority: number;
}

interface PerformanceMetric {
  operation: string;
  duration: number; // ms
  memoryDelta: number; // bytes
  timestamp: number;
}

interface PerformanceReport {
  [operation: string]: {
    sampleCount: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
    averageMemoryDelta: number;
  };
}

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}
```

---

**関連ドキュメント**:
- [基本原則](./architecture-core.md)
- [実装例とベストプラクティス](./architecture-implementation.md)
- [品質管理とメトリクス](./architecture-quality.md)

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境