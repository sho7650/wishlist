## 現行プロジェクト（Wishlist App）での適用例

### ヘキサゴナルアーキテクチャ実装

#### プロジェクト構造

```
src/
├── domain/                 # ドメイン層（ビジネスロジック）
│   ├── entities/
│   │   ├── Wish.ts        # 願いエンティティ
│   │   └── User.ts        # ユーザーエンティティ
│   ├── value-objects/
│   │   ├── WishId.ts      # 願いID値オブジェクト
│   │   ├── SupportCount.ts # 応援数値オブジェクト
│   │   └── SessionId.ts   # セッションID値オブジェクト
│   ├── events/
│   │   ├── WishSupportedEvent.ts
│   │   └── WishCreatedEvent.ts
│   └── exceptions/
│       └── DomainException.ts
├── application/            # アプリケーション層（ユースケース）
│   ├── services/
│   │   ├── WishService.ts # 願い関連ユースケース
│   │   └── SupportService.ts # 応援関連ユースケース
│   └── ports/             # ポート（インターフェース）
│       ├── WishRepository.ts
│       └── EventPublisher.ts
├── adapters/              # アダプター層
│   ├── primary/           # プライマリアダプター（API）
│   │   ├── rest/
│   │   │   ├── WishController.ts
│   │   │   └── SupportController.ts
│   │   └── websocket/
│   │       └── RealtimeController.ts
│   └── secondary/         # セカンダリアダプター（DB）
│       ├── repositories/
│       │   └── PostgreSQLWishRepository.ts
│       └── events/
│           └── EventBusAdapter.ts
└── infrastructure/        # インフラストラクチャ層
    ├── database/
    │   ├── migrations/
    │   └── connection.ts
    ├── session/
    │   └── SessionManager.ts
    └── monitoring/
        └── MetricsCollector.ts
```

#### 具体的実装例

```typescript
// domain/entities/Wish.ts
export class Wish {
  private _domainEvents: DomainEvent[] = [];

  constructor(
    private readonly _id: WishId,
    private readonly _content: WishContent,
    private readonly _authorId: UserId | SessionId,
    private _supportCount: SupportCount = SupportCount.zero(),
    private readonly _supporters: Set<string> = new Set(),
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {}

  public addSupport(supporter: UserId | SessionId): void {
    // ビジネスルール：作者は自分の願いに応援できない
    if (this.isAuthor(supporter)) {
      throw new DomainException(
        "作者は自分の願いに応援できません",
        "SELF_SUPPORT_NOT_ALLOWED"
      );
    }

    // ビジネスルール：重複応援防止
    if (this.isSupportedBy(supporter)) {
      throw new DomainException("既に応援済みです", "ALREADY_SUPPORTED");
    }

    this._supporters.add(supporter.value);
    this._supportCount = this._supportCount.increment();
    this._updatedAt = new Date();

    // ドメインイベント発行
    this.addDomainEvent(
      new WishSupportedEvent(
        this._id,
        supporter,
        this._supportCount,
        new Date()
      )
    );
  }

  public removeSupport(supporter: UserId | SessionId): void {
    if (!this.isSupportedBy(supporter)) {
      throw new DomainException("応援していません", "NOT_SUPPORTED");
    }

    this._supporters.delete(supporter.value);
    this._supportCount = this._supportCount.decrement();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new WishSupportRemovedEvent(
        this._id,
        supporter,
        this._supportCount,
        new Date()
      )
    );
  }

  // 楽観的UI対応：クライアント側での事前チェック用
  public canSupport(supporter: UserId | SessionId): SupportValidation {
    if (this.isAuthor(supporter)) {
      return SupportValidation.failure(
        "SELF_SUPPORT_NOT_ALLOWED",
        "作者は自分の願いに応援できません"
      );
    }

    if (this.isSupportedBy(supporter)) {
      return SupportValidation.failure("ALREADY_SUPPORTED", "既に応援済みです");
    }

    return SupportValidation.success();
  }

  private isAuthor(supporter: UserId | SessionId): boolean {
    return (
      this._authorId.value === supporter.value &&
      this._authorId.type === supporter.type
    );
  }

  private isSupportedBy(supporter: UserId | SessionId): boolean {
    return this._supporters.has(supporter.value);
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // Getters
  get id(): WishId {
    return this._id;
  }
  get content(): WishContent {
    return this._content;
  }
  get authorId(): UserId | SessionId {
    return this._authorId;
  }
  get supportCount(): SupportCount {
    return this._supportCount;
  }
  get supporters(): ReadonlySet<string> {
    return this._supporters;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}

// 楽観的UI対応のための検証結果
export class SupportValidation {
  private constructor(
    private readonly _isValid: boolean,
    private readonly _errorCode?: string,
    private readonly _errorMessage?: string
  ) {}

  static success(): SupportValidation {
    return new SupportValidation(true);
  }

  static failure(errorCode: string, errorMessage: string): SupportValidation {
    return new SupportValidation(false, errorCode, errorMessage);
  }

  get isValid(): boolean {
    return this._isValid;
  }
  get errorCode(): string | undefined {
    return this._errorCode;
  }
  get errorMessage(): string | undefined {
    return this._errorMessage;
  }
}
```

### パフォーマンス最適化事例

#### N+1 問題の解決

```typescript
// adapters/secondary/repositories/PostgreSQLWishRepository.ts
export class PostgreSQLWishRepository implements WishRepository {
  constructor(private readonly pool: Pool) {}

  // N+1問題を回避する最適化クエリ
  async findLatestWithSupportStatus(
    limit: number,
    offset: number,
    viewerId?: UserId | SessionId
  ): Promise<WishWithSupportInfo[]> {
    const viewerIdValue = viewerId?.value;
    const viewerType = viewerId?.type;

    const query = `
      SELECT 
        w.id,
        w.content,
        w.author_id,
        w.author_type,
        w.created_at,
        w.updated_at,
        COALESCE(s.support_count, 0) as support_count,
        CASE 
          WHEN vs.supporter_id IS NOT NULL THEN true 
          ELSE false 
        END as is_supported_by_viewer,
        CASE 
          WHEN w.author_id = $3 AND w.author_type = $4 THEN true 
          ELSE false 
        END as is_authored_by_viewer
      FROM wishes w
      LEFT JOIN (
        SELECT 
          wish_id, 
          COUNT(*) as support_count
        FROM wish_supports 
        GROUP BY wish_id
      ) s ON w.id = s.wish_id
      LEFT JOIN wish_supports vs ON (
        w.id = vs.wish_id 
        AND vs.supporter_id = $3 
        AND vs.supporter_type = $4
      )
      ORDER BY w.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [
      limit,
      offset,
      viewerIdValue || null,
      viewerType || null,
    ]);

    return result.rows.map((row) => this.mapRowToWishWithSupportInfo(row));
  }

  // 楽観的UI対応：バッチでの応援状況取得
  async getSupportStatusBatch(
    wishIds: WishId[],
    viewer: UserId | SessionId
  ): Promise<Map<string, boolean>> {
    if (wishIds.length === 0) {
      return new Map();
    }

    const query = `
      SELECT wish_id
      FROM wish_supports
      WHERE wish_id = ANY($1)
        AND supporter_id = $2
        AND supporter_type = $3
    `;

    const result = await this.pool.query(query, [
      wishIds.map((id) => id.value),
      viewer.value,
      viewer.type,
    ]);

    const supportedWishIds = new Set(result.rows.map((row) => row.wish_id));
    const statusMap = new Map<string, boolean>();

    wishIds.forEach((wishId) => {
      statusMap.set(wishId.value, supportedWishIds.has(wishId.value));
    });

    return statusMap;
  }

  private mapRowToWishWithSupportInfo(row: any): WishWithSupportInfo {
    const authorId =
      row.author_type === "user"
        ? UserId.fromString(row.author_id)
        : SessionId.create(row.author_id);

    const wish = new Wish(
      WishId.fromString(row.id),
      WishContent.create(row.content),
      authorId,
      SupportCount.fromNumber(row.support_count),
      new Set(), // supporters は必要に応じて別途取得
      row.created_at,
      row.updated_at
    );

    return new WishWithSupportInfo(
      wish,
      row.is_supported_by_viewer,
      row.is_authored_by_viewer
    );
  }
}

// パフォーマンス最適化のためのDTO
export class WishWithSupportInfo {
  constructor(
    public readonly wish: Wish,
    public readonly isSupportedByViewer: boolean,
    public readonly isAuthoredByViewer: boolean
  ) {}

  // フロントエンド用のシリアライゼーション
  toClientDTO(): WishClientDTO {
    return {
      id: this.wish.id.value,
      content: this.wish.content.value,
      supportCount: this.wish.supportCount.value,
      isSupportedByViewer: this.isSupportedByViewer,
      isAuthoredByViewer: this.isAuthoredByViewer,
      canSupport: !this.isAuthoredByViewer && !this.isSupportedByViewer,
      createdAt: this.wish.createdAt.toISOString(),
      updatedAt: this.wish.updatedAt.toISOString(),
    };
  }
}
```

#### セッション管理とパフォーマンス

```typescript
// infrastructure/session/SessionManager.ts
export class SessionManager {
  private static readonly SESSION_COOKIE_NAME = "wishlist_session";
  private static readonly SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30日

  // Heroku環境向けのセッション設定
  static configure(app: Express): void {
    app.use(
      session({
        store: new (require("connect-pg-simple")(session))({
          pool: getDbPool(),
          tableName: "session",
          createTableIfMissing: true,
        }),
        name: this.SESSION_COOKIE_NAME,
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: true,
        rolling: true,
        cookie: {
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
          maxAge: this.SESSION_TTL,
          sameSite: "lax",
        },
      })
    );
  }

  // セッションIDの一貫した取得
  static getOrCreateSessionId(req: Request): SessionId {
    if (!req.session.id) {
      req.session.id = crypto.randomUUID();
    }
    return SessionId.create(req.session.id);
  }

  // ユーザーIDまたはセッションIDの取得
  static getViewer(req: Request): UserId | SessionId {
    // 認証済みユーザーの場合
    if (req.user?.id) {
      return UserId.fromNumber(req.user.id);
    }

    // 匿名ユーザーの場合
    return this.getOrCreateSessionId(req);
  }

  // パフォーマンス：セッション情報のキャッシュ
  private static sessionCache = new Map<
    string,
    { viewer: UserId | SessionId; expiry: number }
  >();

  static getCachedViewer(req: Request): UserId | SessionId {
    const sessionKey = req.sessionID || req.session.id;
    const cached = this.sessionCache.get(sessionKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.viewer;
    }

    const viewer = this.getViewer(req);
    this.sessionCache.set(sessionKey, {
      viewer,
      expiry: Date.now() + 60000, // 1分キャッシュ
    });

    return viewer;
  }
}
```

### 楽観的 UI 実装

#### Controller 層での楽観的更新対応

```typescript
// adapters/primary/rest/SupportController.ts
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly wishService: WishService,
    private readonly eventBus: EventBus
  ) {}

  // 楽観的UI: 事前検証エンドポイント
  async canSupport(req: Request, res: Response): Promise<void> {
    try {
      const wishId = WishId.fromString(req.params.wishId);
      const viewer = SessionManager.getCachedViewer(req);

      const wish = await this.wishService.findById(wishId);
      if (!wish) {
        res.status(404).json({
          success: false,
          error: "Wish not found",
        });
        return;
      }

      const validation = wish.canSupport(viewer);

      res.json({
        success: true,
        data: {
          canSupport: validation.isValid,
          errorCode: validation.errorCode,
          errorMessage: validation.errorMessage,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // 応援追加（楽観的更新対応）
  async addSupport(req: Request, res: Response): Promise<void> {
    const startTime = process.hrtime.bigint();

    try {
      const wishId = WishId.fromString(req.params.wishId);
      const viewer = SessionManager.getCachedViewer(req);

      // 楽観的更新: すぐにレスポンスを返す
      res.status(202).json({
        success: true,
        message: "Support request accepted",
        optimistic: true,
      });

      // バックグラウンドで実際の処理
      setImmediate(async () => {
        try {
          await this.supportService.addSupport(wishId, viewer);

          // WebSocket で成功通知
          this.eventBus.publish(new SupportSuccessEvent(wishId, viewer));

          // パフォーマンス測定
          const duration =
            Number(process.hrtime.bigint() - startTime) / 1_000_000;
          console.log(`Support added: ${duration}ms`);
        } catch (error) {
          // WebSocket でエラー通知（ロールバック指示）
          this.eventBus.publish(
            new SupportFailureEvent(wishId, viewer, error.message, error.code)
          );

          console.error("Support addition failed:", error);
        }
      });
    } catch (error) {
      // 即座にエラーレスポンス
      this.handleError(error, res);
    }
  }

  // 応援削除（楽観的更新対応）
  async removeSupport(req: Request, res: Response): Promise<void> {
    try {
      const wishId = WishId.fromString(req.params.wishId);
      const viewer = SessionManager.getCachedViewer(req);

      // 楽観的更新
      res.status(202).json({
        success: true,
        message: "Support removal request accepted",
        optimistic: true,
      });

      // バックグラウンド処理
      setImmediate(async () => {
        try {
          await this.supportService.removeSupport(wishId, viewer);
          this.eventBus.publish(new SupportRemovalSuccessEvent(wishId, viewer));
        } catch (error) {
          this.eventBus.publish(
            new SupportRemovalFailureEvent(
              wishId,
              viewer,
              error.message,
              error.code
            )
          );
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: Error, res: Response): void {
    if (error instanceof DomainException) {
      res.status(422).json({
        success: false,
        error: error.message,
        code: error.code,
        optimistic: false,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        optimistic: false,
      });
    }
  }
}
```

## 品質指標（KPI）と測定

### コード品質メトリクス

#### 測定可能な品質指標

```typescript
// infrastructure/monitoring/QualityMetricsCollector.ts
export interface QualityKPI {
  codeQuality: {
    cyclomaticComplexity: number; // 関数あたり10以下
    testCoverage: number; // 90%以上
    duplicatedCode: number; // 5%以下
    codeSmells: number; // SonarQube基準
  };
  performance: {
    apiResponseTime95th: number; // 95%ile < 200ms
    n1QueryCount: number; // ゼロ実装
    memoryUsageVariation: number; // 基準値±20%以内
    databaseConnectionPool: number; // 使用率80%以下
  };
  maintainability: {
    averageFileSize: number; // 500行以下
    averageFunctionSize: number; // 30行以下
    dependencyDepth: number; // 5層以下
    technicalDebtHours: number; // 技術債務（時間）
  };
  typesSafety: {
    anyTypeUsage: number; // any型使用箇所
    strictModeViolations: number; // 厳格モード違反
    uncheckedIndexAccess: number; // インデックスアクセス警告
  };
}

export class QualityMetricsCollector {
  async collectKPIs(): Promise<QualityKPI> {
    const [codeQuality, performance, maintainability, typesSafety] =
      await Promise.all([
        this.collectCodeQualityMetrics(),
        this.collectPerformanceMetrics(),
        this.collectMaintainabilityMetrics(),
        this.collectTypeSafetyMetrics(),
      ]);

    return {
      codeQuality,
      performance,
      maintainability,
      typesSafety,
    };
  }

  private async collectCodeQualityMetrics() {
    // ESLint + Jest + SonarQube からメトリクス収集
    const eslintReport = await this.runESLintAnalysis();
    const jestCoverage = await this.getJestCoverage();
    const sonarReport = await this.getSonarQubeMetrics();

    return {
      cyclomaticComplexity: eslintReport.averageComplexity,
      testCoverage: jestCoverage.total.lines.pct,
      duplicatedCode: sonarReport.duplicatedLinesDensity,
      codeSmells: sonarReport.codeSmells,
    };
  }

  private async collectPerformanceMetrics() {
    // APM ツールからメトリクス収集
    const apmMetrics = await this.getAPMMetrics();

    return {
      apiResponseTime95th: apmMetrics.responseTime.p95,
      n1QueryCount: await this.detectN1Queries(),
      memoryUsageVariation: apmMetrics.memory.variationPercent,
      databaseConnectionPool: apmMetrics.database.poolUsage,
    };
  }

  // N+1クエリの自動検出
  private async detectN1Queries(): Promise<number> {
    const queryLogs = await this.getQueryLogs();
    const suspiciousPatterns = queryLogs.filter(
      (log) => log.queriesPerRequest > 10 && log.similarQueryCount > 5
    );

    return suspiciousPatterns.length;
  }
}

// 品質KPIダッシュボード
export class QualityDashboard {
  async generateReport(): Promise<QualityReport> {
    const currentKPIs = await this.qualityCollector.collectKPIs();
    const previousKPIs = await this.loadPreviousKPIs();

    const trends = this.calculateTrends(currentKPIs, previousKPIs);
    const violations = this.identifyViolations(currentKPIs);
    const recommendations = this.generateRecommendations(violations, trends);

    return {
      timestamp: new Date(),
      current: currentKPIs,
      trends,
      violations,
      recommendations,
      overallScore: this.calculateOverallScore(currentKPIs),
    };
  }

  private identifyViolations(kpis: QualityKPI): QualityViolation[] {
    const violations: QualityViolation[] = [];

    // コード品質違反
    if (kpis.codeQuality.cyclomaticComplexity > 10) {
      violations.push({
        type: "CODE_COMPLEXITY",
        severity: "HIGH",
        current: kpis.codeQuality.cyclomaticComplexity,
        threshold: 10,
        message: "関数の複雑度が基準を超過しています",
      });
    }

    if (kpis.codeQuality.testCoverage < 90) {
      violations.push({
        type: "TEST_COVERAGE",
        severity: "MEDIUM",
        current: kpis.codeQuality.testCoverage,
        threshold: 90,
        message: "テストカバレッジが基準を下回っています",
      });
    }

    // パフォーマンス違反
    if (kpis.performance.apiResponseTime95th > 200) {
      violations.push({
        type: "RESPONSE_TIME",
        severity: "HIGH",
        current: kpis.performance.apiResponseTime95th,
        threshold: 200,
        message: "API応答時間が基準を超過しています",
      });
    }

    if (kpis.performance.n1QueryCount > 0) {
      violations.push({
        type: "N_PLUS_ONE_QUERY",
        severity: "HIGH",
        current: kpis.performance.n1QueryCount,
        threshold: 0,
        message: "N+1クエリが検出されました",
      });
    }

    return violations;
  }

  private generateRecommendations(
    violations: QualityViolation[],
    trends: QualityTrends
  ): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    violations.forEach((violation) => {
      switch (violation.type) {
        case "CODE_COMPLEXITY":
          recommendations.push({
            priority: "HIGH",
            category: "REFACTORING",
            action: "複雑な関数を小さなメソッドに分割する",
            estimatedEffort: "2-4時間",
            expectedImpact: "複雑度20%削減",
          });
          break;

        case "N_PLUS_ONE_QUERY":
          recommendations.push({
            priority: "HIGH",
            category: "PERFORMANCE",
            action: "JOIN クエリまたはバッチローディングを実装する",
            estimatedEffort: "4-8時間",
            expectedImpact: "データベースクエリ数80%削減",
          });
          break;

        case "TEST_COVERAGE":
          recommendations.push({
            priority: "MEDIUM",
            category: "TESTING",
            action: "未テストの重要な機能にテストを追加する",
            estimatedEffort: "1-2日",
            expectedImpact: "カバレッジ95%達成",
          });
          break;
      }
    });

    return recommendations;
  }
}
```

### パフォーマンス測定の自動化

#### 継続的パフォーマンス監視

```typescript
// infrastructure/monitoring/PerformanceMonitor.ts
export class PerformanceMonitor {
  private readonly thresholds = {
    responseTime: 200, // ms
    memoryUsage: 512, // MB
    cpuUsage: 80, // %
    databaseConnections: 15, // max connections
  };

  // リアルタイム監視
  startMonitoring(): void {
    // API レスポンス時間監視
    this.monitorAPIPerformance();

    // システムリソース監視
    this.monitorSystemResources();

    // データベースパフォーマンス監視
    this.monitorDatabasePerformance();
  }

  private monitorAPIPerformance(): void {
    // Express middleware で全APIエンドポイントを監視
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();

      res.on("finish", () => {
        const duration =
          Number(process.hrtime.bigint() - startTime) / 1_000_000;

        // メトリクス記録
        this.recordAPIMetrics({
          endpoint: `${req.method} ${req.route?.path || req.path}`,
          responseTime: duration,
          statusCode: res.statusCode,
          timestamp: new Date(),
        });

        // 閾値チェック
        if (duration > this.thresholds.responseTime) {
          this.alertSlowAPI({
            endpoint: `${req.method} ${req.path}`,
            responseTime: duration,
            threshold: this.thresholds.responseTime,
          });
        }
      });

      next();
    });
  }

  private monitorDatabasePerformance(): void {
    // PostgreSQL クエリ監視
    const originalQuery = this.pool.query;

    this.pool.query = function (text: string, params?: any[], callback?: any) {
      const startTime = process.hrtime.bigint();
      const queryStart = Date.now();

      const result = originalQuery.call(this, text, params, (err, result) => {
        const duration =
          Number(process.hrtime.bigint() - startTime) / 1_000_000;

        // 遅いクエリの記録
        if (duration > 100) {
          // 100ms threshold
          console.warn("Slow query detected:", {
            query: text.substring(0, 100),
            duration: `${duration}ms`,
            params: params ? "with params" : "no params",
          });
        }

        if (callback) callback(err, result);
      });

      return result;
    };
  }

  // 性能劣化の自動検出
  async detectPerformanceDegradation(): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];

    // 過去24時間と先週の同時刻を比較
    const currentMetrics = await this.getMetrics(24); // 24時間
    const baselineMetrics = await this.getMetrics(24, 7 * 24); // 1週間前

    const responseTimeIncrease = this.calculateIncrease(
      currentMetrics.averageResponseTime,
      baselineMetrics.averageResponseTime
    );

    if (responseTimeIncrease > 20) {
      // 20%以上の劣化
      alerts.push({
        type: "RESPONSE_TIME_DEGRADATION",
        severity: "HIGH",
        message: `応答時間が${responseTimeIncrease}%劣化しました`,
        current: currentMetrics.averageResponseTime,
        baseline: baselineMetrics.averageResponseTime,
      });
    }

    return alerts;
  }
}

// 負荷テストの自動実行
export class LoadTestRunner {
  async runLoadTest(): Promise<LoadTestResult> {
    // Artillery.js を使用した負荷テスト
    const testConfig = {
      target: process.env.APP_URL || "http://localhost:3000",
      phases: [
        { duration: 60, arrivalRate: 5 }, // 1分間、5req/sec
        { duration: 120, arrivalRate: 10 }, // 2分間、10req/sec
        { duration: 60, arrivalRate: 20 }, // 1分間、20req/sec
      ],
      scenarios: [
        {
          name: "願い一覧取得",
          weight: 40,
          flow: [{ get: { url: "/api/wishes" } }],
        },
        {
          name: "応援追加",
          weight: 30,
          flow: [
            {
              post: {
                url: "/api/wishes/{{ $randomUUID }}/support",
                headers: { "Content-Type": "application/json" },
              },
            },
          ],
        },
        {
          name: "願い作成",
          weight: 30,
          flow: [
            {
              post: {
                url: "/api/wishes",
                json: { content: "Load test wish {{ $randomString }}" },
              },
            },
          ],
        },
      ],
    };

    const result = await this.executeArtilleryTest(testConfig);

    return {
      summary: result.summary,
      responseTimeP95: result.aggregate.latency.p95,
      errorRate: result.aggregate.errors / result.aggregate.requestsCompleted,
      passesThreshold:
        result.aggregate.latency.p95 < this.thresholds.responseTime,
    };
  }
}
```

## トラブルシューティングガイド

### よくある設計問題と解決策

#### 1. ドメインロジックの散在

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

#### 2. N+1 クエリ問題の診断と解決

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

// 解決策：バッチローディング
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

#### 3. AI 協調でのコミュニケーション改善

```typescript
// 問題：曖昧なプロンプトによる低品質なコード生成
const POOR_PROMPT = `
応援機能を作って
`;

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

## 技術債務管理

### 技術債務の特定と優先順位付け

#### 自動的な技術債務検出

```typescript
// infrastructure/monitoring/TechnicalDebtDetector.ts
export class TechnicalDebtDetector {
  async detectTechnicalDebt(): Promise<TechnicalDebtItem[]> {
    const [
      codeSmells,
      performanceIssues,
      securityVulnerabilities,
      outdatedDependencies,
      testGaps,
    ] = await Promise.all([
      this.detectCodeSmells(),
      this.detectPerformanceIssues(),
      this.detectSecurityIssues(),
      this.detectOutdatedDependencies(),
      this.detectTestGaps(),
    ]);

    const allDebt = [
      ...codeSmells,
      ...performanceIssues,
      ...securityVulnerabilities,
      ...outdatedDependencies,
      ...testGaps,
    ];

    return this.prioritizeDebt(allDebt);
  }

  private async detectCodeSmells(): Promise<TechnicalDebtItem[]> {
    const eslintResults = await this.runESLintAnalysis();
    const sonarResults = await this.runSonarAnalysis();

    const codeSmells: TechnicalDebtItem[] = [];

    // 複雑度の高い関数
    eslintResults.complexFunctions.forEach((func) => {
      codeSmells.push({
        type: "CODE_COMPLEXITY",
        severity: func.complexity > 15 ? "HIGH" : "MEDIUM",
        location: `${func.file}:${func.line}`,
        description: `関数 ${func.name} の複雑度が ${func.complexity} です`,
        estimatedEffort: this.estimateRefactoringEffort(func.complexity),
        impact: "MAINTAINABILITY",
        priority: this.calculatePriority(func.complexity, "COMPLEXITY"),
      });
    });

    // 重複コード
    sonarResults.duplicatedBlocks.forEach((block) => {
      codeSmells.push({
        type: "CODE_DUPLICATION",
        severity: block.size > 50 ? "HIGH" : "MEDIUM",
        location: block.locations.join(", "),
        description: `${block.size}行の重複コードブロック`,
        estimatedEffort: Math.ceil(block.size / 20) + "時間",
        impact: "MAINTAINABILITY",
        priority: this.calculatePriority(block.size, "DUPLICATION"),
      });
    });

    // 長すぎるファイル
    const largeFiles = await this.findLargeFiles();
    largeFiles.forEach((file) => {
      codeSmells.push({
        type: "LARGE_FILE",
        severity: file.lines > 1000 ? "HIGH" : "MEDIUM",
        location: file.path,
        description: `ファイルサイズが ${file.lines}行です`,
        estimatedEffort: "2-4時間",
        impact: "MAINTAINABILITY",
        priority: this.calculatePriority(file.lines, "FILE_SIZE"),
      });
    });

    return codeSmells;
  }

  private async detectPerformanceIssues(): Promise<TechnicalDebtItem[]> {
    const performanceIssues: TechnicalDebtItem[] = [];

    // N+1クエリの検出
    const n1Queries = await this.detectN1Queries();
    n1Queries.forEach((query) => {
      performanceIssues.push({
        type: "N_PLUS_ONE_QUERY",
        severity: "HIGH",
        location: query.location,
        description: `N+1クエリパターン: ${query.pattern}`,
        estimatedEffort: "4-8時間",
        impact: "PERFORMANCE",
        priority: 9, // 高優先度
      });
    });

    // 遅いAPIエンドポイント
    const slowEndpoints = await this.getSlowEndpoints();
    slowEndpoints.forEach((endpoint) => {
      performanceIssues.push({
        type: "SLOW_ENDPOINT",
        severity: endpoint.p95 > 500 ? "HIGH" : "MEDIUM",
        location: endpoint.path,
        description: `95%ile応答時間: ${endpoint.p95}ms`,
        estimatedEffort: "2-6時間",
        impact: "PERFORMANCE",
        priority: this.calculatePriority(endpoint.p95, "RESPONSE_TIME"),
      });
    });

    // メモリリーク
    const memoryLeaks = await this.detectMemoryLeaks();
    memoryLeaks.forEach((leak) => {
      performanceIssues.push({
        type: "MEMORY_LEAK",
        severity: "HIGH",
        location: leak.source,
        description: `メモリリーク: ${leak.growthRate}MB/hour`,
        estimatedEffort: "8-16時間",
        impact: "STABILITY",
        priority: 10, // 最高優先度
      });
    });

    return performanceIssues;
  }

  private prioritizeDebt(debtItems: TechnicalDebtItem[]): TechnicalDebtItem[] {
    return debtItems.sort((a, b) => {
      // 優先度、影響度、修正コストを考慮した複合スコア
      const scoreA = this.calculateComprehensiveScore(a);
      const scoreB = this.calculateComprehensiveScore(b);
      return scoreB - scoreA;
    });
  }

  private calculateComprehensiveScore(item: TechnicalDebtItem): number {
    const severityWeight = {
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const impactWeight = {
      STABILITY: 10,
      SECURITY: 9,
      PERFORMANCE: 8,
      MAINTAINABILITY: 6,
      USABILITY: 4,
    };

    const effortPenalty = this.parseEffortHours(item.estimatedEffort);

    return (
      item.priority * 2 +
      severityWeight[item.severity] * 3 +
      impactWeight[item.impact] * 2 -
      Math.log(effortPenalty + 1) // 修正コストが高いほどペナルティ
    );
  }
}

// 段階的改善アプローチ
export class TechnicalDebtResolver {
  async createImprovementPlan(
    debtItems: TechnicalDebtItem[]
  ): Promise<ImprovementPlan> {
    const prioritized = debtItems.slice(0, 20); // 上位20件
    const phases = this.groupIntoPhases(prioritized);

    return {
      totalItems: debtItems.length,
      selectedItems: prioritized.length,
      estimatedTotalEffort: this.calculateTotalEffort(prioritized),
      phases: phases.map((phase, index) => ({
        phaseNumber: index + 1,
        title: this.generatePhaseTitle(phase),
        items: phase,
        estimatedEffort: this.calculateTotalEffort(phase),
        expectedBenefits: this.calculateExpectedBenefits(phase),
        claudeCodePrompts: this.generateClaudeCodePrompts(phase),
      })),
    };
  }

  private groupIntoPhases(items: TechnicalDebtItem[]): TechnicalDebtItem[][] {
    const phases: TechnicalDebtItem[][] = [];
    let currentPhase: TechnicalDebtItem[] = [];
    let currentPhaseEffort = 0;
    const maxPhaseEffort = 40; // 40時間/フェーズ

    for (const item of items) {
      const itemEffort = this.parseEffortHours(item.estimatedEffort);

      if (
        currentPhaseEffort + itemEffort > maxPhaseEffort &&
        currentPhase.length > 0
      ) {
        phases.push(currentPhase);
        currentPhase = [];
        currentPhaseEffort = 0;
      }

      currentPhase.push(item);
      currentPhaseEffort += itemEffort;
    }

    if (currentPhase.length > 0) {
      phases.push(currentPhase);
    }

    return phases;
  }

  private generateClaudeCodePrompts(
    phaseItems: TechnicalDebtItem[]
  ): ClaudePrompt[] {
    return phaseItems.map((item) => {
      switch (item.type) {
        case "CODE_COMPLEXITY":
          return {
            title: `複雑度削減: ${item.location}`,
            prompt: `
## Context
Wishlist アプリケーションの技術債務解決

## Problem
${item.description}
場所: ${item.location}

## Goal
サイクロマティック複雑度を10以下に削減

## Requirements
1. 既存機能の動作を維持
2. TypeScript の型安全性を保持
3. テストカバレッジを維持または向上
4. 以下の手法を適用:
   - メソッド抽出
   - 早期リターン
   - ガード句の使用
   - 戦略パターン（必要に応じて）

## Expected Output
1. リファクタリング後のコード
2. 変更箇所の説明
3. 追加/更新が必要なテスト
4. 複雑度の改善効果測定

実装後、複雑度測定ツールで検証します。
            `,
          };

        case "N_PLUS_ONE_QUERY":
          return {
            title: `N+1クエリ解決: ${item.location}`,
            prompt: `
## Context
Wishlist アプリケーションのパフォーマンス最適化

## Problem
${item.description}
場所: ${item.location}

## Goal
N+1クエリを単一のJOINクエリまたはバッチローディングで解決

## Requirements
1. PostgreSQL の最適化クエリ実装
2. TypeScript の型安全性維持
3. レスポンス時間の95%ile < 200ms達成
4. メモリ使用量の最適化

## Expected Output
1. 最適化されたクエリ実装
2. Repository層の改善
3. パフォーマンステスト
4. インデックス設計の提案
5. 改善効果の測定結果

ベンチマーク比較も提供してください。
            `,
          };

        case "CODE_DUPLICATION":
          return {
            title: `重複コード排除: ${item.location}`,
            prompt: `
## Context
Wishlist アプリケーションのコード品質改善

## Problem
${item.description}
場所: ${item.location}

## Goal
DRY原則に従い重複コードを共通化

## Requirements
1. 適切な抽象化レベルでの共通化
2. 過度な一般化を避ける
3. 既存機能の動作保持
4. テストの追加/更新

## Expected Output
1. 共通化されたコード
2. 抽象化戦略の説明
3. 影響範囲の分析
4. 更新されたテスト

保守性向上の観点からの評価も含めてください。
            `,
          };

        default:
          return {
            title: `技術債務解決: ${item.type}`,
            prompt: `
${item.description}
場所: ${item.location}

この技術債務を解決するための実装を提供してください。
            `,
          };
      }
    });
  }
}

// 改善効果の測定
export class ImprovementTracker {
  async trackImprovement(
    beforeMetrics: QualityKPI,
    afterMetrics: QualityKPI,
    resolvedDebt: TechnicalDebtItem[]
  ): Promise<ImprovementReport> {
    const improvements = this.calculateImprovements(
      beforeMetrics,
      afterMetrics
    );
    const roi = this.calculateROI(resolvedDebt, improvements);

    return {
      period: {
        start: beforeMetrics.timestamp,
        end: afterMetrics.timestamp,
      },
      resolvedItems: resolvedDebt.length,
      totalEffortSpent: this.calculateTotalEffort(resolvedDebt),
      improvements: {
        codeQuality: {
          complexityReduction: this.calculatePercentageChange(
            beforeMetrics.codeQuality.cyclomaticComplexity,
            afterMetrics.codeQuality.cyclomaticComplexity
          ),
          testCoverageIncrease:
            afterMetrics.codeQuality.testCoverage -
            beforeMetrics.codeQuality.testCoverage,
          codeSmellReduction:
            beforeMetrics.codeQuality.codeSmells -
            afterMetrics.codeQuality.codeSmells,
        },
        performance: {
          responseTimeImprovement: this.calculatePercentageChange(
            beforeMetrics.performance.apiResponseTime95th,
            afterMetrics.performance.apiResponseTime95th
          ),
          n1QueryElimination:
            beforeMetrics.performance.n1QueryCount -
            afterMetrics.performance.n1QueryCount,
          memoryUsageStabilization: this.calculatePercentageChange(
            beforeMetrics.performance.memoryUsageVariation,
            afterMetrics.performance.memoryUsageVariation
          ),
        },
      },
      roi: roi,
      recommendations: this.generateFutureRecommendations(improvements),
    };
  }

  private calculateROI(
    resolvedDebt: TechnicalDebtItem[],
    improvements: any
  ): ROIAnalysis {
    const investmentHours = this.calculateTotalEffort(resolvedDebt);
    const hourlyRate = 100; // $100/hour 仮定
    const investment = investmentHours * hourlyRate;

    // 改善による時間節約の計算
    const maintenanceTimeSaving =
      improvements.codeQuality.complexityReduction * 0.1; // 複雑度1%削減 = 0.1時間/月節約
    const performanceGain =
      improvements.performance.responseTimeImprovement * 0.05; // 応答時間1%改善 = 0.05時間/月節約

    const monthlySaving =
      (maintenanceTimeSaving + performanceGain) * hourlyRate;
    const annualSaving = monthlySaving * 12;
    const paybackPeriod = investment / monthlySaving;

    return {
      investment: investment,
      annualSaving: annualSaving,
      paybackPeriodMonths: paybackPeriod,
      roi: (annualSaving - investment) / investment,
      qualitativeImpacts: [
        "開発速度の向上",
        "バグ発生率の低下",
        "チームの士気向上",
        "システムの安定性向上",
      ],
    };
  }

  private generateFutureRecommendations(improvements: any): string[] {
    const recommendations: string[] = [];

    if (improvements.codeQuality.complexityReduction > 20) {
      recommendations.push(
        "複雑度削減が効果的でした。同様のパターンを他のモジュールにも適用してください"
      );
    }

    if (improvements.performance.n1QueryElimination > 0) {
      recommendations.push(
        "N+1クエリ解決により大幅なパフォーマンス改善を達成。定期的なクエリ監視を継続してください"
      );
    }

    if (improvements.codeQuality.testCoverageIncrease > 5) {
      recommendations.push(
        "テストカバレッジ向上により品質が安定。未テスト領域への対応を継続してください"
      );
    }

    return recommendations;
  }
}
```

### 継続的改善プロセス

#### 自動化された改善サイクル

````typescript
// infrastructure/monitoring/ContinuousImprovementEngine.ts
export class ContinuousImprovementEngine {
  constructor(
    private readonly debtDetector: TechnicalDebtDetector,
    private readonly debtResolver: TechnicalDebtResolver,
    private readonly improvementTracker: ImprovementTracker,
    private readonly qualityCollector: QualityMetricsCollector
  ) {}

  async runImprovementCycle(): Promise<ImprovementCycleResult> {
    console.log('🔄 継続的改善サイクル開始');

    // 1. 現在の品質メトリクス収集
    const beforeMetrics = await this.qualityCollector.collectKPIs();
    console.log('📊 品質メトリクス収集完了');

    // 2. 技術債務の検出
    const detectedDebt = await this.debtDetector.detectTechnicalDebt();
    console.log(`🔍 技術債務 ${detectedDebt.length} 件検出`);

    // 3. 改善計画の作成
    const improvementPlan = await this.debtResolver.createImprovementPlan(detectedDebt);
    console.log(`📋 ${improvementPlan.phases.length} フェーズの改善計画作成`);

    // 4. Claude Code プロンプトの生成と実行提案
    const claudePrompts = this.generateMasterPrompt(improvementPlan);
    console.log('🤖 Claude Code 協働プロンプト生成完了');

    // 5. 改善提案レポートの作成
    const report = await this.generateImprovementReport(
      beforeMetrics,
      detectedDebt,
      improvementPlan,
      claudePrompts
    );

    return {
      currentMetrics: beforeMetrics,
      detectedDebt,
      improvementPlan,
      claudePrompts,
      report,
      executionGuidance: this.generateExecutionGuidance(improvementPlan)
    };
  }

  private generateMasterPrompt(plan: ImprovementPlan): MasterImprovementPrompt {
    return {
      overview: `
# Wishlist アプリケーション品質改善マスタープラン

## 概要
合計 ${plan.selectedItems} 件の技術債務を ${plan.phases.length} フェーズで解決
推定工数: ${plan.estimatedTotalEffort}時間

## 改善効果予測
- コード品質: 20-30%向上
- パフォーマンス: 15-25%改善
- 保守性: 40-50%向上
- 開発速度: 長期的に30%向上

## 実行アプローチ
各フェーズを順次実行し、Claude Code との協働で効率的に改善を進めます。
      `,
      phases: plan.phases.map(phase => ({
        title: phase.title,
        summary: `${phase.items.length} 項目、推定 ${phase.estimatedEffort}時間`,
        priority: this.calculatePhasePriority(phase),
        claudePrompts: phase.claudeCodePrompts,
        validationCriteria: this.generateValidationCriteria(phase)
      }))
    };
  }

  private generateExecutionGuidance(plan: ImprovementPlan): ExecutionGuidance {
    return {
      recommendedSchedule: this.generateSchedule(plan),
      teamResources: this.estimateResourceNeeds(plan),
      riskMitigation: this.identifyRisks(plan),
      successCriteria: this.defineSuccessCriteria(plan),
      claudeCollaborationTips: [
        '各フェーズ開始前に現在のコード状況をClaudeに説明する',
        '段階的な改善を重視し、一度に大きな変更は避ける',
        '改善後は必ずテストを実行し、品質メトリクスを測定する',
        'プロンプトには具体的な成功基準を含める',
        '改善効果が期待値を下回る場合は、アプローチを見直す'
      ]
    };
  }

  private generateSchedule(plan: ImprovementPlan): ImprovementSchedule {
    const schedule: ImprovementSchedule = {
      totalDuration: Math.ceil(plan.estimatedTotalEffort / 8) + '営業日',
      phases: plan.phases.map((phase, index) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + (index * 7)); // 1週間間隔

        return {
          phaseNumber: index + 1,
          startDate: startDate.toISOString().split('T')[0],
          duration: Math.ceil(this.parseEffortHours(phase.estimatedEffort) / 8) + '営業日',
          milestones: [
            'Claude Code 協働による実装完了',
            'ユニットテスト更新',
            '品質メトリクス検証',
            'レビューと承認'
          ]
        };
      })
    };

    return schedule;
  }
}

// 改善効果の可視化
export class ImprovementVisualization {
  generateDashboard(
    beforeMetrics: QualityKPI,
    afterMetrics: QualityKPI,
    improvementHistory: ImprovementReport[]
  ): QualityDashboard {
    return {
      summary: {
        totalImprovements: improvementHistory.length,
        totalEffortInvested: improvementHistory.reduce((sum, report) =>
          sum + this.parseEffortHours(report.totalEffortSpent), 0
        ),
        averageROI: this.calculateAverageROI(improvementHistory),
        currentQualityScore: this.calculateQualityScore(afterMetrics)
      },
      trends: {
        codeQuality: this.generateTrendData('codeQuality', improvementHistory),
        performance: this.generateTrendData('performance', improvementHistory),
        maintainability: this.generateTrendData('maintainability', improvementHistory)
      },
      recommendations: {
        nextPriorities: this.identifyNextPriorities(afterMetrics),
        preventiveMeasures: this.suggestPreventiveMeasures(improvementHistory),
        claudeCollaborationTips: this.generateCollaborationTips(improvementHistory)
      }
    };
  }

  private generateCollaborationTips(history: ImprovementReport[]): string[] {
    const tips: string[] = [];

    // 成功パターンの分析
    const successfulPatterns = history.filter(report => report.roi.roi > 0.5);
    if (successfulPatterns.length > 0) {
      tips.push('過去の成功事例: 段階的なリファクタリングアプローチが効果的でした');
    }

    // 効果的なプロンプトパターンの特定
    const highImpactImprovements = history.filter(report =>
      report.improvements.codeQuality.complexityReduction > 15
    );
    if (highImpactImprovements.length > 0) {
      tips.push('効果的なプロンプト: 具体的な複雑度削減目標を設定すると良い結果が得られます');
    }

    return tips;
  }
}
```## 品質測定指標と継続的改善

### 1. コード品質メトリクス

#### TypeScript/Node.js 固有の測定指標
```typescript
// package.json の scripts 設定例
{
  "scripts": {
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "complexity": "complexity-report --format json src/**/*.ts",
    "audit": "npm audit && snyk test",
    "performance": "clinic doctor -- node dist/server.js"
  }
}
````

#### 複雑性測定

```typescript
// .complexity-report.json 設定例
{
  "maxComplexity": 10,
  "maxFiles": 100,
  "maxFunctions": 20,
  "excludePattern": "**/*.test.ts",
  "warningThreshold": 7,
  "errorThreshold": 10
}

// 実装例: 複雑性を抑えた設計
export class WishlistService {
  // 単一責任の原則に従い、メソッドを小さく保つ
  async addItemToWishlist(
    userId: UserId,
    productId: ProductId,
    priority: Priority
  ): Promise<void> {
    const wishlist = await this.getOrCreateWishlist(userId);
    this.validateAddition(wishlist, productId);
    wishlist.addItem(productId, priority);
    await this.repository.save(wishlist);
    await this.publishEvent(new ItemAddedEvent(wishlist.id, productId));
  }

  private async getOrCreateWishlist(userId: UserId): Promise<Wishlist> {
    const existing = await this.repository.findByUserId(userId);
    return existing || Wishlist.create(userId);
  }

  private validateAddition(wishlist: Wishlist, productId: ProductId): void {
    if (wishlist.itemCount >= this.maxItems) {
      throw new DomainError('Wishlist is full', 'WISHLIST_FULL');
    }
  }
}
```

### 2. パフォーマンス測定

#### データベースクエリパフォーマンス

```typescript
// クエリパフォーマンス監視
export class PerformanceMonitoringRepository implements WishlistRepository {
  constructor(
    private readonly underlying: WishlistRepository,
    private readonly logger: Logger
  ) {}

  async findByUserId(userId: UserId): Promise<Wishlist | null> {
    const start = process.hrtime.bigint();
    try {
      const result = await this.underlying.findByUserId(userId);
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000;

      this.logger.info("Query performance", {
        operation: "findByUserId",
        duration: `${duration}ms`,
        userId: userId.value,
      });

      if (duration > 100) {
        this.logger.warn("Slow query detected", {
          operation: "findByUserId",
          duration: `${duration}ms`,
          threshold: "100ms",
        });
      }

      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
      this.logger.error("Query failed", {
        operation: "findByUserId",
        duration: `${duration}ms`,
        error: error.message,
      });
      throw error;
    }
  }
}
```

#### API レスポンス時間測定

```typescript
import { Request, Response, NextFunction } from "express";

export const performanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1_000_000;

    console.log({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });

    // 遅いAPIエンドポイントの警告
    if (duration > 1000) {
      console.warn("Slow API endpoint", {
        endpoint: `${req.method} ${req.url}`,
        duration: `${duration}ms`,
        threshold: "1000ms",
      });
    }
  });

  next();
};
```

### 3. 保守性測定

#### コードカバレッジ

```typescript
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./src/domain/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
    "!src/types/**",
  ],
};
```

#### 型安全性スコア

```typescript
// tsconfig.json - 厳格な型チェック設定
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}

// 型安全性を高める実装例
export interface StrictWishlistRepository {
  findByUserId(userId: UserId): Promise<Wishlist | null>;
  save(wishlist: Wishlist): Promise<void>;
  // 戻り値や引数の型を厳密に定義
}

// never型を活用した網羅性チェック
export const getPriorityColor = (priority: Priority): string => {
  switch (priority.value) {
    case 1: return 'red';
    case 2: return 'orange';
    case 3: return 'yellow';
    case 4: return 'green';
    case 5: return 'blue';
    default:
      // 全ケースが網羅されていることをコンパイル時に保証
      const _exhaustive: never = priority.value;
      throw new Error(`Unhandled priority: ${_exhaustive}`);
  }
};
```

### 4. 継続的改善のフィードバックループ

#### 自動化されたコード品質チェック

```yaml
# .github/workflows/quality-check.yml
name: Code Quality Check

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Test with coverage
        run: npm run test:coverage

      - name: Complexity check
        run: npm run complexity

      - name: Security audit
        run: npm audit --audit-level=moderate

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

#### 品質ダッシュボード

```typescript
// 品質メトリクス収集
export interface QualityMetrics {
  codeComplexity: {
    average: number;
    maximum: number;
    violationCount: number;
  };
  testCoverage: {
    lines: number;
    branches: number;
    functions: number;
  };
  performance: {
    averageResponseTime: number;
    slowEndpointCount: number;
    databaseQueryTime: number;
  };
  typesSafety: {
    typeErrors: number;
    strictModeViolations: number;
    anyUsage: number;
  };
  maintainability: {
    technicalDebt: number; // 時間単位
    codeSmells: number;
    duplicatedLines: number;
  };
}

// メトリクス収集サービス
export class QualityMetricsCollector {
  async collectMetrics(): Promise<QualityMetrics> {
    const [complexity, coverage, performance, types, maintainability] =
      await Promise.all([
        this.collectComplexityMetrics(),
        this.collectCoverageMetrics(),
        this.collectPerformanceMetrics(),
        this.collectTypeSafetyMetrics(),
        this.collectMaintainabilityMetrics(),
      ]);

    return {
      codeComplexity: complexity,
      testCoverage: coverage,
      performance,
      typesSafety: types,
      maintainability,
    };
  }

  private async collectComplexityMetrics() {
    // ESLintの複雑度ルールからメトリクスを収集
    const report = await this.runComplexityAnalysis();
    return {
      average: report.averageComplexity,
      maximum: report.maxComplexity,
      violationCount: report.violations.length,
    };
  }

  private async collectCoverageMetrics() {
    // Jestのカバレッジレポートから収集
    const coverage = await this.getCoverageReport();
    return {
      lines: coverage.lines.pct,
      branches: coverage.branches.pct,
      functions: coverage.functions.pct,
    };
  }
}
```

### 5. Claude Code 特化の品質向上戦略

#### AI との協働における品質指標

```typescript
/**
 * Claude Code での開発品質を測定するための指標
 */
export interface AICollaborationMetrics {
  promptClarity: {
    ambiguousRequests: number;
    clarificationRounds: number;
    successfulFirstAttempts: number;
  };
  codeGeneration: {
    generatedLinesOfCode: number;
    manualModificationRate: number; // %
    aiSuggestionAcceptanceRate: number; // %
  };
  iterativeImprovement: {
    refactoringCycles: number;
    codeQualityImprovement: number; // %
    testCoverageIncrease: number; // %
  };
}

// プロンプト効果測定
export class PromptEffectivenessTracker {
  trackPromptOutcome(
    prompt: string,
    generatedCode: string,
    acceptedWithoutModification: boolean,
    qualityScore: number
  ): void {
    const metrics = {
      promptLength: prompt.length,
      codeLength: generatedCode.length,
      accepted: acceptedWithoutModification,
      quality: qualityScore,
      timestamp: new Date(),
    };

    this.saveMetrics(metrics);
    this.analyzePromptPatterns(prompt, qualityScore);
  }

  private analyzePromptPatterns(prompt: string, quality: number): void {
    // 高品質なコードを生成したプロンプトのパターンを学習
    const patterns = this.extractPatterns(prompt);
    this.updateEffectivePatterns(patterns, quality);
  }
}
```

#### 継続的学習とベストプラクティス更新

```typescript
// ベストプラクティス進化システム
export class BestPracticeEvolution {
  async updatePractices(): Promise<void> {
    const metrics = await this.collectRecentMetrics();
    const insights = await this.analyzeMetrics(metrics);

    if (insights.significantImprovement) {
      await this.updateArchitecturePrinciples(insights.improvements);
      await this.notifyTeam(insights);
    }
  }

  private async analyzeMetrics(
    metrics: QualityMetrics[]
  ): Promise<AnalysisInsights> {
    // 過去30日間のメトリクス傾向分析
    const trends = this.calculateTrends(metrics);

    return {
      significantImprovement: trends.improvement > 0.15, // 15%以上の改善
      improvements: trends.topImprovements,
      concerns: trends.degradingAreas,
      recommendations: this.generateRecommendations(trends),
    };
  }

  private generateRecommendations(trends: MetricTrends): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (trends.complexity.increasing) {
      recommendations.push({
        type: "CODE_COMPLEXITY",
        priority: "HIGH",
        action: "リファクタリングセッションを開催し、複雑なメソッドを分割する",
        estimatedImpact: "複雑度20%削減",
      });
    }

    if (trends.performance.declining) {
      recommendations.push({
        type: "PERFORMANCE",
        priority: "MEDIUM",
        action: "データベースクエリを最適化し、N+1問題を解決する",
        estimatedImpact: "レスポンス時間30%改善",
      });
    }

    return recommendations;
  }
}
```

## Claude Code プロンプト最適化ガイド

### 1. 効果的なプロンプト設計パターン

#### コンテキスト設定テンプレート

```typescript
/**
 * Claude Code プロンプトテンプレート
 *
 * Context: [プロジェクト概要]
 * Tech Stack: TypeScript, Node.js, PostgreSQL, Express
 * Domain: [ビジネスドメイン]
 *
 * Current State: [現在の実装状況]
 * Goal: [達成したい目標]
 *
 * Constraints:
 * - DDD principles must be followed
 * - Type safety is mandatory
 * - Performance considerations for 10k+ users
 *
 * Expected Output:
 * 1. [具体的な期待値1]
 * 2. [具体的な期待値2]
 * 3. [具体的な期待値3]
 */

// 実際のプロンプト例
const WISHLIST_FEATURE_PROMPT = `
Context: E-commerce wishlist feature development
Tech Stack: TypeScript, Node.js, PostgreSQL, Express
Domain: User wishlist management

Current State: Basic user authentication is implemented
Goal: Implement wishlist sharing functionality between users

Constraints:
- Users can share wishlists with specific friends
- Shared wishlists are read-only for recipients
- Privacy settings must be respected
- Performance: Support 1000+ concurrent shares

Expected Output:
1. Domain model with sharing entities and value objects
2. Repository interfaces for share management
3. API endpoints with proper validation
4. PostgreSQL schema with optimized indexes
5. TypeScript types for frontend integration

Please implement this step by step, starting with the domain model.
`;
```

#### 段階的複雑性制御

```typescript
// Step 1: 基本実装のプロンプト
const STEP1_PROMPT = `
Start with the simplest implementation of wishlist sharing:
- User can generate a share link for their wishlist
- Link has expiration time
- Anyone with link can view (no auth required)

Focus on:
1. Domain entities (ShareLink, ExpirationTime)
2. Basic repository interface
3. Simple service method

Keep it minimal and extensible.
`;

// Step 2: 機能拡張のプロンプト
const STEP2_PROMPT = `
Building on the previous implementation, add:
- Private sharing (specific user recipients)
- Permission levels (view-only, add-items)
- Share activity tracking

Extend the existing code while maintaining:
- Backward compatibility
- Clean separation of concerns
- Type safety
`;

// Step 3: 最適化のプロンプト
const STEP3_PROMPT = `
Optimize the sharing implementation for:
- Database query performance (expect 10k+ shares)
- Memory efficiency in Node.js
- Caching strategy for frequently accessed shares

Provide:
1. Optimized database queries
2. Caching layer implementation
3. Performance monitoring hooks
`;
```

### 2. フィードバックループの確立

#### コード品質向上サイクル

````typescript
export class CodeQualityFeedbackLoop {
  async runQualityImprovement(): Promise<void> {
    // 1. 現在の品質メトリクス収集
    const currentMetrics = await this.collectCurrentMetrics();

    // 2. 改善点の特定
    const improvements = this.identifyImprovements(currentMetrics);

    // 3. Claude Code への改善プロンプト生成
    const improvementPrompts = this.generateImprovementPrompts(improvements);

    // 4. 改善実装（AI協働）
    for (const prompt of improvementPrompts) {
      console.log(`Improvement suggestion: ${prompt.description}`);
      console.log(`Prompt: ${prompt.instruction}`);
      // Claude Code でこのプロンプトを実行
    }

    // 5. 改善効果測定
    setTimeout(async () => {
      const newMetrics = await this.collectCurrentMetrics();
      this.measureImprovement(currentMetrics, newMetrics);
    }, 24 * 60 * 60 * 1000); // 24時間後
  }

  private generateImprovementPrompts(improvements: Improvement[]): PromptSuggestion[] {
    return improvements.map(improvement => {
      switch (improvement.type) {
        case 'COMPLEXITY_REDUCTION':
          return {
            description: `Reduce complexity in ${improvement.location}`,
            instruction: `
              Refactor the following code to reduce cyclomatic complexity:

              Current complexity: ${improvement.currentValue}
              Target complexity: ${improvement.targetValue}

              File: ${improvement.location}

              Apply these techniques:
              1. Extract smaller methods
              2. Use early returns
              3. Replace nested conditions with guard clauses
              4. Consider strategy pattern for complex conditionals

              Maintain existing functionality and type safety.
            `
          };

        case 'PERFORMANCE_OPTIMIZATION':
          return {
            description: `Optimize performance in ${improvement.location}`,
            instruction: `
              Optimize the performance of this code:

              Current metric: ${improvement.currentValue}
              Target: ${improvement.targetValue}

              Focus areas:
              1. Database query optimization
              2. Caching implementation
              3. Memory usage reduction
              4. Async/await efficiency

              Provide before/after performance comparison.
            `
          };

        default:
          throw new Error(`Unknown improvement type: ${improvement.type}`);
      }
    });
  }
}
```# Claude Code ソフトウェアアーキテクチャ原則

## 概要
本ドキュメントは、Claude Code（Claude搭載のAIアシスタント開発環境）を使用した開発プロジェクトにおける、ソフトウェアアーキテクチャの設計原則とガイドラインを定義します。

## 基本原則

### 1. AI協調型設計（AI-Collaborative Design）

#### プロンプト設計とコンテキスト管理
- **構造化されたコンテキスト**: プロジェクトの背景、技術スタック、制約条件を明確に伝達
- **段階的な情報提供**: 複雑な要件を小さな単位に分割して順次説明
- **具体的な期待値の設定**: 求める出力の形式、品質基準、制約を明示

```typescript
// Claude Code へのプロンプト例
/**
 * Context: TypeScript/Node.js + PostgreSQL のWishlistアプリケーション
 *
 * 要件:
 * - User エンティティの作成
 * - email の一意性制約
 * - createdAt/updatedAt の自動管理
 * - 型安全性の確保
 *
 * 期待する出力:
 * 1. TypeScript インターフェース定義
 * 2. バリデーション機能付きクラス実装
 * 3. データベースマッピング考慮
 */
````

#### AI との効果的な対話手法

- **明確な指示出し**: 曖昧さを排除した具体的な要求
- **段階的複雑性制御**: シンプルな実装から開始し、徐々に機能を拡張
- **継続的なフィードバック**: 生成されたコードのレビューと改善指示

#### コンテキスト維持戦略

- **プロジェクト設定の文書化**: README.md に AI 協働のためのガイドラインを記載
- **コード規約の明示**: ESLint/Prettier 設定と AI への指示の整合性確保
- **ドメイン知識の蓄積**: ビジネスルールと要件を段階的に AI に教育

### 2. 段階的複雑性管理（Incremental Complexity Management）

- **小さな単位での開発**: 機能を小さなコンポーネントに分割し、段階的に構築する
- **反復的改善**: AI フィードバックを活用した継続的なコード改善を行う
- **プロトタイプ優先**: 完璧を求めず、動作するプロトタイプから始める

### 3. 説明可能性（Explainability）

- **設計判断の文書化**: なぜその設計を選択したかを明確に記録する
- **トレードオフの明示**: パフォーマンス、保守性、拡張性のバランスを文書化する
- **依存関係の可視化**: モジュール間の依存関係を図示し、説明する

## アーキテクチャパターン

### 推奨パターン

#### 1. レイヤードアーキテクチャ

```
プレゼンテーション層
    ↓
ビジネスロジック層
    ↓
データアクセス層
    ↓
データ永続化層
```

**適用場面**: 従来的な Web アプリケーション、CRUD 操作中心のシステム

#### 2. ヘキサゴナルアーキテクチャ（ポートアンドアダプター）

```
        External APIs
            ↓
        Adapters
            ↓
        Ports
            ↓
    Business Logic Core
            ↓
        Ports
            ↓
        Adapters
            ↓
        Database
```

**適用場面**: 複雑なビジネスロジック、外部システム連携が多いシステム

#### 3. マイクロサービスアーキテクチャ

```
API Gateway
    ↓
Service A ← Service B ← Service C
    ↓           ↓           ↓
Database A  Database B  Database C
```

**適用場面**: 大規模システム、チーム分散開発、独立したデプロイが必要

#### 4. ドメイン駆動設計（DDD）

```
Application Layer
    ↓
Domain Layer
    ├── Entities
    ├── Value Objects
    ├── Domain Services
    ├── Repositories (Interface)
    └── Domain Events
    ↓
Infrastructure Layer
    ├── Repositories (Implementation)
    ├── External Services
    └── Database
```

**適用場面**: 複雑なビジネスロジック、長期保守が必要なシステム、業務専門家との協働

## ドメイン駆動設計（DDD）実践指針

### 1. 戦略的設計

#### 境界づけられたコンテキスト（Bounded Context）

```python
# 注文コンテキスト
class Order:
    def __init__(self, order_id: OrderId, customer_id: CustomerId):
        self.order_id = order_id
        self.customer_id = customer_id
        self.items = []
        self.status = OrderStatus.PENDING

# 在庫コンテキスト
class Product:
    def __init__(self, product_id: ProductId, stock_quantity: int):
        self.product_id = product_id
        self.stock_quantity = stock_quantity
```

#### コンテキストマップ

- **共有カーネル**: 共通のドメインモデルを共有
- **顧客・供給者**: 上流・下流の関係を明確化
- **適合者**: 外部システムとのインターフェース層

### 2. 戦術的設計

#### エンティティ（Entity）

```python
class Customer:
    def __init__(self, customer_id: CustomerId, email: EmailAddress):
        self._customer_id = customer_id
        self._email = email
        self._orders = []

    @property
    def customer_id(self) -> CustomerId:
        return self._customer_id

    def place_order(self, order: Order) -> None:
        # ビジネスルールの実装
        if not self._can_place_order():
            raise DomainException("顧客は注文を行うことができません")
        self._orders.append(order)
```

#### 値オブジェクト（Value Object）

```python
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class Money:
    amount: float
    currency: str

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("金額は負の値にできません")
        if not self.currency:
            raise ValueError("通貨は必須です")

    def add(self, other: 'Money') -> 'Money':
        if self.currency != other.currency:
            raise ValueError("異なる通貨同士は加算できません")
        return Money(self.amount + other.amount, self.currency)
```

#### 集約（Aggregate）

```python
class Order:  # 集約ルート
    def __init__(self, order_id: OrderId, customer_id: CustomerId):
        self._order_id = order_id
        self._customer_id = customer_id
        self._items = []
        self._status = OrderStatus.PENDING
        self._total = Money(0, "JPY")

    def add_item(self, product_id: ProductId, quantity: int, price: Money) -> None:
        # 不変条件の維持
        if self._status != OrderStatus.PENDING:
            raise DomainException("確定済みの注文には商品を追加できません")

        item = OrderItem(product_id, quantity, price)
        self._items.append(item)
        self._recalculate_total()

    def confirm(self) -> None:
        if not self._items:
            raise DomainException("商品のない注文は確定できません")
        self._status = OrderStatus.CONFIRMED
        # ドメインイベントの発行
        self._domain_events.append(OrderConfirmedEvent(self._order_id))
```

#### ドメインサービス（Domain Service）

```python
class PricingService:
    def __init__(self, discount_repository: DiscountRepository):
        self._discount_repository = discount_repository

    def calculate_order_price(self, order: Order, customer: Customer) -> Money:
        base_price = order.calculate_base_price()
        discount = self._discount_repository.find_applicable_discount(customer)
        return base_price.subtract(discount.calculate_discount(base_price))
```

#### リポジトリ（Repository）

```python
from abc import ABC, abstractmethod

class OrderRepository(ABC):
    @abstractmethod
    def save(self, order: Order) -> None:
        pass

    @abstractmethod
    def find_by_id(self, order_id: OrderId) -> Optional[Order]:
        pass

    @abstractmethod
    def find_by_customer(self, customer_id: CustomerId) -> List[Order]:
        pass

# 実装例
class SqlOrderRepository(OrderRepository):
    def __init__(self, db_connection):
        self._db = db_connection

    def save(self, order: Order) -> None:
        # SQLによる永続化の実装
        pass

    def find_by_id(self, order_id: OrderId) -> Optional[Order]:
        # SQLによる取得の実装
        pass
```

### 3. ドメインイベント

#### イベントの定義

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class DomainEvent:
    occurred_at: datetime

@dataclass
class OrderConfirmedEvent(DomainEvent):
    order_id: OrderId
    customer_id: CustomerId
    total_amount: Money
```

#### イベントの発行・処理

```python
class EventBus:
    def __init__(self):
        self._handlers = {}

    def register_handler(self, event_type: type, handler: callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    def publish(self, event: DomainEvent):
        event_type = type(event)
        if event_type in self._handlers:
            for handler in self._handlers[event_type]:
                handler(event)

# イベントハンドラー
def handle_order_confirmed(event: OrderConfirmedEvent):
    # 在庫減少処理
    # 請求書発行処理
    # 通知送信処理
    pass
```

### 4. アプリケーションサービス

#### コマンドとクエリの分離（CQRS）

```python
# コマンド側（書き込み）
class PlaceOrderCommand:
    def __init__(self, customer_id: str, items: List[OrderItemDto]):
        self.customer_id = customer_id
        self.items = items

class OrderApplicationService:
    def __init__(self, order_repository: OrderRepository,
                 customer_repository: CustomerRepository,
                 event_bus: EventBus):
        self._order_repository = order_repository
        self._customer_repository = customer_repository
        self._event_bus = event_bus

    def place_order(self, command: PlaceOrderCommand) -> OrderId:
        customer = self._customer_repository.find_by_id(
            CustomerId(command.customer_id)
        )
        if not customer:
            raise ApplicationException("顧客が見つかりません")

        order = Order(OrderId.generate(), customer.customer_id)
        for item_dto in command.items:
            order.add_item(
                ProductId(item_dto.product_id),
                item_dto.quantity,
                Money(item_dto.price, "JPY")
            )

        order.confirm()
        self._order_repository.save(order)

        # ドメインイベントの発行
        for event in order.domain_events:
            self._event_bus.publish(event)

        return order.order_id

# クエリ側（読み込み）
class OrderQueryService:
    def __init__(self, query_db):
        self._query_db = query_db

    def get_order_summary(self, order_id: str) -> OrderSummaryDto:
        # 読み込み専用の最適化されたクエリ
        return self._query_db.get_order_summary(order_id)
```

### 5. DDD 実践のベストプラクティス

#### ユビキタス言語（Ubiquitous Language）

- **業務用語の統一**: コードとドメインエキスパートの会話で同じ用語を使用
- **用語集の作成**: プロジェクト固有の用語を定義・管理
- **継続的な改善**: 理解の深化とともに言語を洗練

#### モデリング手法

- **イベントストーミング**: ドメインイベントから業務フローを理解
- **ドメインストーリーテリング**: 具体的なシナリオからモデルを抽出
- **例示による仕様**: 具体例を通じてビジネスルールを明確化

#### 実装上の注意点

- **アネミックドメインモデルの回避**: データと振る舞いを適切に配置
- **技術的関心事の分離**: ドメインロジックと技術的実装の分離
- **境界の適切な設定**: 過度に細分化せず、適切な粒度で境界を設定

## Claude Code AI 協調開発フロー

### 1. 要件分析フェーズ

#### ユーザーストーリーからドメインモデルへの変換

```typescript
/**
 * ユーザーストーリー例:
 * "匿名ユーザーが他のユーザーの願いに応援できるが、同じ願いに複数回応援はできない"
 *
 * Claude Code プロンプト例:
 */
const DOMAIN_MODELING_PROMPT = `
現在のwishlistアプリケーションで、匿名ユーザーの応援機能を実装しています。

ビジネスルール：
- 1ユーザー（ログイン/匿名）につき1つの願いに対して1応援のみ
- セッションベースで匿名ユーザーを識別
- 楽観的UIでUX向上（即座にUI更新、バックエンドは非同期）
- 応援の取り消しも可能

技術制約：
- TypeScript + Node.js + PostgreSQL
- セッション管理はexpress-session使用
- DDD アーキテクチャ採用

DDD観点での設計提案をお願いします：
1. 集約の境界をどこに設定すべきか
2. SupportAction の値オブジェクト設計
3. 匿名ユーザーと登録ユーザーの統一的な扱い方
4. ドメインイベントの設計
5. 楽観的UI対応のための設計考慮事項

期待する出力：
- TypeScript インターフェース定義
- 集約ルートとなるエンティティ
- 主要な値オブジェクト
- ドメインイベント定義
- ビジネスルール検証ロジック
`;
```

#### AI 協調プロンプト設計のベストプラクティス

```typescript
/**
 * 効果的なプロンプト構造
 */
interface EffectivePrompt {
  context: {
    projectBackground: string;
    currentState: string;
    technicalStack: string[];
  };
  requirements: {
    businessRules: string[];
    technicalConstraints: string[];
    performanceRequirements: string[];
  };
  expectations: {
    outputFormat: string;
    qualityStandards: string[];
    deliverables: string[];
  };
  iterationGuidance: {
    startSimple: boolean;
    buildIncrementally: boolean;
    maintainBackwardCompatibility: boolean;
  };
}

// 実際のプロンプト設計例
const IMPLEMENTATION_PROMPT = `
Context:
- Wishlist アプリケーション
- 現在のWishエンティティは基本的なCRUD機能のみ
- PostgreSQL でのパフォーマンス最適化が必要

Requirements:
- 応援機能の追加実装
- セッションベース識別（匿名ユーザー対応）
- 同一ユーザーの重複応援防止
- 応答時間: 95%ile < 200ms

Expectations:
- TypeScript実装（厳格な型安全性）
- ドメインイベント対応
- ユニットテスト付き
- PostgreSQL最適化クエリ

Phase 1: まずは最小限の機能実装
- Wish エンティティに応援機能追加
- 基本的な重複チェック
- シンプルなドメインイベント

後続フェーズで性能最適化とUI対応を行います。
`;
```

### 2. 実装フェーズ

#### 段階的実装アプローチ

```typescript
// Phase 1: 基本機能実装のプロンプト
const PHASE1_PROMPT = `
Wishエンティティに応援機能を追加してください。

要件：
- addSupport() メソッド
- 重複応援チェック
- ドメインイベント発行
- 型安全性の確保

実装してください：
1. Wish クラスの拡張
2. SupportCount 値オブジェクト
3. Supporter 型（UserId | SessionId）
4. WishSupportedEvent ドメインイベント
5. 基本的なユニットテスト

コードは段階的に拡張可能な設計にしてください。
`;

// Phase 2: パフォーマンス最適化のプロンプト
const PHASE2_PROMPT = `
Phase 1の実装を基に、パフォーマンス最適化を行ってください。

現在の課題：
- N+1クエリ問題
- 応援状況の効率的な取得
- 大量データでの応答時間

最適化対象：
1. Repository パターンの最適化
2. PostgreSQL クエリ改善
3. キャッシュ戦略
4. バッチ処理対応

目標：
- API応答時間 < 200ms
- 10,000件の願い + 100,000応援での性能維持

実装してください：
1. 最適化されたクエリ
2. インデックス設計
3. キャッシュ層実装
4. パフォーマンステスト
`;

// Phase 3: フロントエンド連携のプロンプト
const PHASE3_PROMPT = `
楽観的UI対応のためのAPI設計を行ってください。

要件：
- 即座のUI更新（楽観的更新）
- エラー時のロールバック機能
- リアルタイム同期（WebSocket対応）
- 型安全なAPI契約

実装してください：
1. 楽観的更新対応のController
2. WebSocketイベント設計
3. フロントエンド用型定義
4. エラーハンドリング戦略
5. 統合テスト

TypeScript の型安全性を最大限活用してください。
`;
```

### 3. テスト・リファクタリングフェーズ

#### 品質向上のためのプロンプト

```typescript
const QUALITY_IMPROVEMENT_PROMPT = `
実装済みの応援機能について、コード品質を向上させてください。

現在のコード：
[実装済みコードを貼り付け]

改善観点：
1. SOLID原則の適用状況
2. サイクロマティック複雑度の削減
3. テストカバレッジの向上
4. エラーハンドリングの強化
5. パフォーマンスの最適化

具体的に改善してください：
- 複雑度10以上の関数の分割
- エッジケースのテスト追加
- エラーメッセージの国際化対応
- ログ出力の最適化
- メモリ使用量の削減

改善前後の比較も提供してください。
`;

const REFACTORING_PROMPT = `
次の技術債務を解決してください：

技術債務項目：
1. 重複コードの排除（DRY原則）
2. 深いネストの解消
3. 適切な抽象化レベルの設定
4. 依存関係の整理

対象コード：
[問題のあるコードを特定]

リファクタリング方針：
- 既存機能の動作を維持
- テストの追加・更新
- 段階的な改善（一度に大きく変更しない）
- 型安全性の向上

期待する成果：
- 保守性の向上
- 可読性の向上
- 拡張性の向上
- パフォーマンスの維持
`;
```

### 4. AI 協調開発における効果測定

#### プロンプト効果性の追跡

```typescript
export class PromptEffectivenessTracker {
  private metrics: PromptMetric[] = [];

  trackPromptOutcome(prompt: PromptData): void {
    const metric: PromptMetric = {
      promptId: crypto.randomUUID(),
      promptType: prompt.type, // 'DOMAIN_MODELING' | 'IMPLEMENTATION' | 'OPTIMIZATION'
      promptLength: prompt.content.length,
      contextClarity: this.assessContextClarity(prompt),
      outputQuality: prompt.outputQuality, // 1-10 scale
      iterationsNeeded: prompt.iterationsNeeded,
      acceptedWithoutModification: prompt.acceptedWithoutModification,
      timeToCompletion: prompt.timeToCompletion,
      timestamp: new Date(),
    };

    this.metrics.push(metric);
    this.analyzePatterns();
  }

  private analyzePatterns(): void {
    const recentMetrics = this.metrics.slice(-50); // 直近50回

    const patterns = {
      highQualityPrompts: recentMetrics.filter((m) => m.outputQuality >= 8),
      lowIterationPrompts: recentMetrics.filter((m) => m.iterationsNeeded <= 2),
      quickCompletionPrompts: recentMetrics.filter(
        (m) => m.timeToCompletion <= 30
      ),
    };

    // パターン分析結果をログ出力
    console.log("AI協調効果分析:", {
      averageQuality: this.calculateAverage(recentMetrics, "outputQuality"),
      averageIterations: this.calculateAverage(
        recentMetrics,
        "iterationsNeeded"
      ),
      acceptanceRate: this.calculateAcceptanceRate(recentMetrics),
      recommendations: this.generateRecommendations(patterns),
    });
  }

  private generateRecommendations(patterns: any): string[] {
    const recommendations: string[] = [];

    if (
      patterns.highQualityPrompts.length < patterns.lowIterationPrompts.length
    ) {
      recommendations.push(
        "プロンプトの詳細化を行い、一回での高品質アウトプットを目指す"
      );
    }

    if (patterns.quickCompletionPrompts.length < 10) {
      recommendations.push("プロンプトテンプレートの活用で効率化を図る");
    }

    return recommendations;
  }
}
```

### 避けるべきパターン

- **モノリシックな巨大クラス**: 単一責任原則に違反する設計
- **深い継承階層**: 理解が困難で保守性が低い
- **グローバル状態への過度な依存**: テストと保守が困難

### アーキテクチャ横断的原則

#### ドメインオブジェクトの活用

どのアーキテクチャパターンを採用する場合でも、以下の DDD の基本概念を可能な限り適用する：

- **値オブジェクト（Value Objects）**: プリミティブ型の代わりに意味のある値オブジェクトを使用
- **エンティティ（Entities）**: 識別子を持つビジネス上重要なオブジェクト
- **集約（Aggregates）**: 関連するオブジェクトの境界と不変条件の維持

#### 関数・メソッド設計原則

```typescript
// ❌ 避けるべき設計 - プリミティブ型の多用
function addSupport(
  wishId: string,
  userId: number | null,
  sessionId: string
): boolean {
  // 匿名ユーザーと登録ユーザーの判定が曖昧
  // エラーハンドリングが不明確
}

// ✅ 推奨設計 - 値オブジェクトとエンティティの活用
function addSupport(wish: Wish, supporter: Supporter): SupportResult {
  // 型安全性とビジネスルールの明確化
}

// Wishlistプロジェクト実装例
export class Wish {
  constructor(
    private readonly _id: WishId,
    private readonly _content: WishContent,
    private _supportCount: SupportCount = SupportCount.zero(),
    private readonly _supporters: Set<string> = new Set()
  ) {}

  public addSupport(supporter: UserId | SessionId): DomainEvent[] {
    // ビジネスルール：同一ユーザーの重複応援防止
    const supporterId = supporter.value;
    if (this._supporters.has(supporterId)) {
      throw new DomainException("既に応援済みです", "ALREADY_SUPPORTED");
    }

    this._supporters.add(supporterId);
    this._supportCount = this._supportCount.increment();

    return [new WishSupportedEvent(this._id, supporter, new Date())];
  }

  public removeSupport(supporter: UserId | SessionId): DomainEvent[] {
    const supporterId = supporter.value;
    if (!this._supporters.has(supporterId)) {
      throw new DomainException("応援していません", "NOT_SUPPORTED");
    }

    this._supporters.delete(supporterId);
    this._supportCount = this._supportCount.decrement();

    return [new WishSupportRemovedEvent(this._id, supporter, new Date())];
  }

  public isSupportedBy(supporter: UserId | SessionId): boolean {
    return this._supporters.has(supporter.value);
  }

  // Getters
  get id(): WishId {
    return this._id;
  }
  get content(): WishContent {
    return this._content;
  }
  get supportCount(): SupportCount {
    return this._supportCount;
  }
  get supporters(): ReadonlySet<string> {
    return this._supporters;
  }
}

// 値オブジェクトの実装例
export class SupportCount {
  private constructor(private readonly _value: number) {
    if (_value < 0) {
      throw new Error("Support count cannot be negative");
    }
  }

  static zero(): SupportCount {
    return new SupportCount(0);
  }

  static fromNumber(value: number): SupportCount {
    return new SupportCount(value);
  }

  increment(): SupportCount {
    return new SupportCount(this._value + 1);
  }

  decrement(): SupportCount {
    if (this._value === 0) {
      throw new Error("Cannot decrement zero support count");
    }
    return new SupportCount(this._value - 1);
  }

  get value(): number {
    return this._value;
  }

  equals(other: SupportCount): boolean {
    return this._value === other._value;
  }
}

// セッションベース識別のための値オブジェクト
export interface SessionId {
  readonly value: string;
  readonly type: "session";
}

export interface UserId {
  readonly value: string;
  readonly type: "user";
}

export type Supporter = UserId | SessionId;

export const SessionId = {
  create: (sessionId: string): SessionId => ({
    value: sessionId,
    type: "session",
  }),

  generate: (): SessionId => ({
    value: crypto.randomUUID(),
    type: "session",
  }),
};

export const UserId = {
  fromNumber: (id: number): UserId => ({
    value: id.toString(),
    type: "user",
  }),

  fromString: (id: string): UserId => ({
    value: id,
    type: "user",
  }),
};
```

#### レイヤードアーキテクチャでの適用例

```python
# プレゼンテーション層
class UserController:
    def register_user(self, request_data: dict) -> Response:
        # DTOから値オブジェクトへの変換
        user_info = UserRegistrationInfo(
            email=EmailAddress(request_data['email']),
            age=Age(request_data['age']),
            name=UserName(request_data['name'])
        )
        user = self.user_service.register(user_info)
        return Response(user.to_dict())

# ビジネスロジック層
class UserService:
    def register(self, user_info: UserRegistrationInfo) -> User:
        user_id = UserId.generate()
        user = User(user_id, user_info.email, user_info.age, user_info.name)
        self.user_repository.save(user)
        return user
```

#### マイクロサービスでの適用例

```python
# サービス間通信でも値オブジェクトを活用
class OrderService:
    def create_order(self, customer_id: CustomerId, items: List[OrderItem]) -> OrderId:
        order = Order(OrderId.generate(), customer_id)
        for item in items:
            order.add_item(item.product_id, item.quantity, item.price)
        return self.order_repository.save(order)

# 他のサービスとの通信
class InventoryService:
    def reserve_products(self, reservations: List[ProductReservation]) -> ReservationResult:
        # 型安全な通信
        pass
```

#### ヘキサゴナルアーキテクチャでの適用例

```python
# ポート（インターフェース）
class PaymentPort:
    def process_payment(self, payment_request: PaymentRequest) -> PaymentResult:
        pass

# アダプター
class StripePaymentAdapter(PaymentPort):
    def process_payment(self, payment_request: PaymentRequest) -> PaymentResult:
        # Stripe APIとの連携
        stripe_amount = payment_request.amount.to_cents()
        stripe_currency = payment_request.amount.currency.code
        # ...
```

## コーディング標準

### 1. 命名規則

- **インターフェース名**: PascalCase（例: `UserService`, `OrderProcessor`）
- **クラス名**: PascalCase（例: `UserService`, `OrderProcessor`）
- **関数名**: camelCase（例: `calculateTotal`, `validateInput`）
- **定数名**: UPPER_SNAKE_CASE（例: `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`）
- **変数名**: camelCase（例: `userId`, `orderDetails`）
- **型名**: PascalCase（例: `UserId`, `EmailAddress`）

### 2. TypeScript/Node.js 固有の規約

#### 型定義とインターフェース

```typescript
// 値オブジェクト（Value Object）
export interface EmailAddress {
  readonly value: string;
}

export const EmailAddress = {
  create: (email: string): EmailAddress => {
    if (!email.includes("@")) {
      throw new Error("Invalid email format");
    }
    return { value: email };
  },

  equals: (a: EmailAddress, b: EmailAddress): boolean => {
    return a.value === b.value;
  },
};

// エンティティ（Entity）
export interface User {
  readonly id: UserId;
  readonly email: EmailAddress;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserId {
  readonly value: string;
}

export const UserId = {
  generate: (): UserId => ({
    value: crypto.randomUUID(),
  }),

  fromString: (id: string): UserId => ({
    value: id,
  }),
};
```

#### 集約とビジネスロジック

```typescript
// Wishlist 集約
export class Wishlist {
  private constructor(
    private readonly _id: WishlistId,
    private readonly _userId: UserId,
    private readonly _items: WishlistItem[],
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(userId: UserId): Wishlist {
    return new Wishlist(
      WishlistId.generate(),
      userId,
      [],
      new Date(),
      new Date()
    );
  }

  addItem(productId: ProductId, priority: Priority = Priority.MEDIUM): void {
    if (this.hasItem(productId)) {
      throw new Error("Product already in wishlist");
    }

    if (this._items.length >= 100) {
      throw new Error("Wishlist is full");
    }

    const item = WishlistItem.create(productId, priority);
    this._items.push(item);
    this._updatedAt = new Date();
  }

  removeItem(productId: ProductId): void {
    const index = this._items.findIndex(
      (item) => item.productId.value === productId.value
    );

    if (index === -1) {
      throw new Error("Product not found in wishlist");
    }

    this._items.splice(index, 1);
    this._updatedAt = new Date();
  }

  get id(): WishlistId {
    return this._id;
  }
  get userId(): UserId {
    return this._userId;
  }
  get items(): readonly WishlistItem[] {
    return this._items;
  }
  get itemCount(): number {
    return this._items.length;
  }

  private hasItem(productId: ProductId): boolean {
    return this._items.some((item) => item.productId.value === productId.value);
  }
}
```

### 3. コメント標準（TypeScript）

````typescript
/**
 * ウィッシュリストの合計価格を計算します
 *
 * @param wishlist - 計算対象のウィッシュリスト
 * @param priceService - 価格取得サービス
 * @returns 合計価格（税込み）
 *
 * @throws {Error} 価格が取得できない商品がある場合
 *
 * @example
 * ```typescript
 * const total = await calculateWishlistTotal(wishlist, priceService);
 * console.log(`Total: ${total.amount} ${total.currency}`);
 * ```
 */
export async function calculateWishlistTotal(
  wishlist: Wishlist,
  priceService: PriceService
): Promise<Money> {
  // 実装...
}
````

### 3. エラーハンドリング（TypeScript/Node.js）

```typescript
// カスタムエラークラス
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(field: string, value: any, reason: string) {
    super(
      `Validation failed for field '${field}': ${reason}`,
      "VALIDATION_ERROR",
      { field, value, reason }
    );
    this.name = "ValidationError";
  }
}

// エラーハンドリングの実装例
export class WishlistService {
  async createWishlist(userId: UserId): Promise<Wishlist> {
    try {
      const existingWishlist = await this.repository.findByUserId(userId);
      if (existingWishlist) {
        throw new DomainError(
          "User already has a wishlist",
          "WISHLIST_ALREADY_EXISTS",
          { userId: userId.value }
        );
      }

      const wishlist = Wishlist.create(userId);
      await this.repository.save(wishlist);

      this.logger.info("Wishlist created", {
        wishlistId: wishlist.id.value,
        userId: userId.value,
      });

      return wishlist;
    } catch (error) {
      this.logger.error("Failed to create wishlist", {
        userId: userId.value,
        error: error.message,
      });
      throw error;
    }
  }
}
```

## 依存関係管理

### 1. 依存性注入（Dependency Injection）

```python
class OrderService:
    def __init__(self, payment_gateway: PaymentGateway, notification_service: NotificationService):
        self.payment_gateway = payment_gateway
        self.notification_service = notification_service
```

### 2. 抽象化の活用

```python
from abc import ABC, abstractmethod

class PaymentGateway(ABC):
    @abstractmethod
    def process_payment(self, amount: float, card_info: CardInfo) -> PaymentResult:
        pass
```

### 3. 設定管理

- **環境変数**: 設定値は環境変数で管理
- **設定ファイル**: 複雑な設定は構造化ファイル（YAML、JSON）で管理
- **デフォルト値**: 必須でない設定には適切なデフォルト値を設定

## テスト戦略

### 1. テストピラミッド

```
    E2E Tests (少数)
        ↓
Integration Tests (中程度)
        ↓
Unit Tests (多数)
```

### 2. テスト種別

- **単体テスト**: 個別の関数・メソッドをテスト
- **統合テスト**: モジュール間の連携をテスト
- **エンドツーエンドテスト**: ユーザーシナリオ全体をテスト

### 3. テスト駆動開発（TDD）

1. 失敗するテストを書く
2. テストが通る最小限のコードを書く
3. コードをリファクタリングする

## Node.js/PostgreSQL 特化実装

### 1. データベース設計とパフォーマンス最適化

#### PostgreSQL スキーマ設計

```sql
-- ユーザーテーブル
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ウィッシュリストテーブル
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ウィッシュリストアイテムテーブル
CREATE TABLE wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    priority INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wishlist_id, product_id)
);

-- パフォーマンス最適化のためのインデックス
CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX idx_wishlist_items_priority ON wishlist_items(wishlist_id, priority);
CREATE INDEX idx_users_email ON users(email);
```

#### TypeScript データアクセス層

```typescript
import { Pool, PoolClient } from "pg";

// リポジトリインターフェース
export interface WishlistRepository {
  save(wishlist: Wishlist): Promise<void>;
  findById(id: WishlistId): Promise<Wishlist | null>;
  findByUserId(userId: UserId): Promise<Wishlist | null>;
  delete(id: WishlistId): Promise<void>;
}

// PostgreSQL実装
export class PostgreSQLWishlistRepository implements WishlistRepository {
  constructor(private readonly pool: Pool) {}

  async save(wishlist: Wishlist): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // ウィッシュリスト保存
      await client.query(
        `
        INSERT INTO wishlists (id, user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          updated_at = EXCLUDED.updated_at
      `,
        [
          wishlist.id.value,
          wishlist.userId.value,
          wishlist.createdAt,
          wishlist.updatedAt,
        ]
      );

      // 既存アイテム削除
      await client.query("DELETE FROM wishlist_items WHERE wishlist_id = $1", [
        wishlist.id.value,
      ]);

      // アイテム一括挿入（パフォーマンス最適化）
      if (wishlist.items.length > 0) {
        const values = wishlist.items
          .map(
            (item, index) =>
              `(${index * 4 + 1}, ${index * 4 + 2}, ${index * 4 + 3}, ${
                index * 4 + 4
              })`
          )
          .join(", ");

        const params = wishlist.items.flatMap((item) => [
          item.id.value,
          wishlist.id.value,
          item.productId.value,
          item.priority.value,
        ]);

        await client.query(
          `
          INSERT INTO wishlist_items (id, wishlist_id, product_id, priority)
          VALUES ${values}
        `,
          params
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: UserId): Promise<Wishlist | null> {
    const client = await this.pool.connect();
    try {
      // 最適化されたJOINクエリ
      const result = await client.query(
        `
        SELECT 
          w.id as wishlist_id,
          w.user_id,
          w.created_at as wishlist_created_at,
          w.updated_at as wishlist_updated_at,
          wi.id as item_id,
          wi.product_id,
          wi.priority,
          wi.added_at
        FROM wishlists w
        LEFT JOIN wishlist_items wi ON w.id = wi.wishlist_id
        WHERE w.user_id = $1
        ORDER BY wi.priority DESC, wi.added_at ASC
      `,
        [userId.value]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowsToWishlist(result.rows);
    } finally {
      client.release();
    }
  }

  private mapRowsToWishlist(rows: any[]): Wishlist {
    const firstRow = rows[0];
    const items = rows
      .filter((row) => row.item_id)
      .map((row) =>
        WishlistItem.reconstruct(
          WishlistItemId.fromString(row.item_id),
          ProductId.fromString(row.product_id),
          Priority.fromValue(row.priority),
          row.added_at
        )
      );

    return Wishlist.reconstruct(
      WishlistId.fromString(firstRow.wishlist_id),
      UserId.fromString(firstRow.user_id),
      items,
      firstRow.wishlist_created_at,
      firstRow.wishlist_updated_at
    );
  }
}
```

### 2. API 設計とフロントエンド連携

#### RESTful API 設計

```typescript
import express from "express";
import { body, param, validationResult } from "express-validator";

export class WishlistController {
  constructor(
    private readonly wishlistService: WishlistService,
    private readonly authService: AuthService
  ) {}

  // ウィッシュリスト取得
  async getWishlist(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    try {
      const userId = await this.authService.getUserIdFromToken(
        req.headers.authorization
      );
      const wishlist = await this.wishlistService.getWishlistByUserId(userId);

      res.json({
        success: true,
        data: this.mapWishlistToDTO(wishlist),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // アイテム追加
  async addItem(req: express.Request, res: express.Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    try {
      const userId = await this.authService.getUserIdFromToken(
        req.headers.authorization
      );
      const { productId, priority } = req.body;

      await this.wishlistService.addItemToWishlist(
        userId,
        ProductId.fromString(productId),
        Priority.fromValue(priority || 2)
      );

      res.status(201).json({
        success: true,
        message: "Item added to wishlist",
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private mapWishlistToDTO(wishlist: Wishlist | null): WishlistDTO | null {
    if (!wishlist) return null;

    return {
      id: wishlist.id.value,
      userId: wishlist.userId.value,
      items: wishlist.items.map((item) => ({
        id: item.id.value,
        productId: item.productId.value,
        priority: item.priority.value,
        addedAt: item.addedAt.toISOString(),
      })),
      itemCount: wishlist.itemCount,
      createdAt: wishlist.createdAt.toISOString(),
      updatedAt: wishlist.updatedAt.toISOString(),
    };
  }

  private handleError(error: Error, res: express.Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: "Validation Error",
        details: error.details,
      });
    } else if (error instanceof DomainError) {
      res.status(422).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
      });
    }
  }
}

// ルーティング設定
export const createWishlistRoutes = (
  controller: WishlistController
): express.Router => {
  const router = express.Router();

  router.get("/wishlist", controller.getWishlist.bind(controller));

  router.post(
    "/wishlist/items",
    [
      body("productId").isUUID().withMessage("Product ID must be a valid UUID"),
      body("priority")
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage("Priority must be between 1 and 5"),
    ],
    controller.addItem.bind(controller)
  );

  router.delete(
    "/wishlist/items/:itemId",
    [param("itemId").isUUID().withMessage("Item ID must be a valid UUID")],
    controller.removeItem.bind(controller)
  );

  return router;
};
```

### 3. フロントエンド型安全性

#### 共有型定義

```typescript
// shared/types/wishlist.ts - フロントエンドと共有
export interface WishlistDTO {
  id: string;
  userId: string;
  items: WishlistItemDTO[];
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItemDTO {
  id: string;
  productId: string;
  priority: number;
  addedAt: string;
}

export interface CreateWishlistItemRequest {
  productId: string;
  priority?: number;
}

export interface WishlistResponse {
  success: boolean;
  data?: WishlistDTO;
  error?: string;
  details?: any;
}
```

### 2. キャッシュ戦略

- **メモリキャッシュ**: 頻繁にアクセスされるデータのキャッシュ
- **分散キャッシュ**: スケーラブルなキャッシュソリューション
- **キャッシュ無効化**: データ整合性を保つ適切な無効化戦略

### 3. 非同期処理

- **非同期 I/O**: I/O 待機時間の最小化
- **バックグラウンドタスク**: 重い処理の非同期実行
- **イベント駆動**: 疎結合な非同期アーキテクチャ

## セキュリティ原則

### 1. 認証・認可

- **多要素認証**: 重要なシステムでは多要素認証を実装
- **最小権限の原則**: 必要最小限の権限のみを付与
- **セッション管理**: 安全なセッション管理の実装

### 2. データ保護

- **暗号化**: 機密データの暗号化（保存時・転送時）
- **入力検証**: 全ての入力データの検証
- **出力エスケープ**: XSS 攻撃の防止

### 3. インフラストラクチャセキュリティ

- **HTTPS**: 全ての通信で HTTPS を使用
- **ファイアウォール**: 適切なネットワークセキュリティ
- **定期的な更新**: 依存関係とシステムの定期的な更新

## デプロイメント戦略

### 1. 継続的インテグレーション/継続的デプロイメント（CI/CD）

```yaml
# .github/workflows/ci-cd.yml の例
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: ./deploy.sh
```

### 2. 環境管理

- **開発環境**: 開発者個人の環境
- **ステージング環境**: 本番環境に近い検証環境
- **本番環境**: 実際のユーザーが使用する環境

### 3. リリース戦略

- **ブルーグリーンデプロイメント**: ゼロダウンタイムデプロイメント
- **カナリアリリース**: 段階的なリリース
- **フィーチャーフラグ**: 機能の動的な有効/無効化

## 監視・ログ

### 1. アプリケーション監視

- **メトリクス収集**: パフォーマンス指標の収集
- **アラート設定**: 異常検知とアラート
- **ダッシュボード**: 可視化とモニタリング

### 2. ログ管理

- **構造化ログ**: JSON 形式での統一されたログ出力
- **ログレベル**: 適切なログレベルの使い分け
- **ログ集約**: 中央集約されたログ管理

### 3. エラートラッキング

- **エラー監視**: 自動的なエラー検知と通知
- **スタックトレース**: 詳細なエラー情報の収集
- **エラー分析**: エラーパターンの分析と改善

## 保守性・拡張性

### 1. コードの保守性

- **単一責任原則**: 各クラス・関数は単一の責任を持つ
- **開放閉鎖原則**: 拡張に対して開放的、修正に対して閉鎖的
- **依存関係逆転原則**: 高レベルモジュールは低レベルモジュールに依存しない

### 2. 拡張性の考慮

- **プラグインアーキテクチャ**: 機能の動的な追加
- **設定による振る舞い変更**: ハードコーディングの回避
- **スケーラビリティ**: 負荷増加に対する対応策

### 3. リファクタリング戦略

- **継続的なリファクタリング**: 小さな改善の積み重ね
- **レガシーコードの段階的置き換え**: ビッグバンリライトの回避
- **テストによる安全性確保**: リファクタリング時のテストカバレッジ

## チーム開発

### 1. コードレビュー

- **必須レビュー**: 全てのコード変更はレビューを通す
- **建設的なフィードバック**: 改善提案とベストプラクティスの共有
- **知識共有**: コードレビューを通じた知識の共有

### 2. ドキュメンテーション

- **アーキテクチャドキュメント**: 設計思想と構造の文書化
- **API 仕様**: 明確な API 仕様の提供
- **運用手順**: デプロイメントと運用手順の文書化

### 3. コミュニケーション

- **設計議論**: アーキテクチャ決定の透明性
- **知識共有セッション**: 技術的な知識の共有
- **コーディング標準の統一**: チーム内での一貫性確保

## まとめ

これらの原則は、Claude Code を使用した TypeScript/Node.js + PostgreSQL 環境での開発プロジェクトにおいて、保守性が高く、拡張性があり、型安全性を重視したソフトウェアアーキテクチャを構築するためのガイドラインです。

### 主要な特徴

#### AI 協調開発の最適化

- **構造化されたプロンプト設計**: コンテキスト、制約、期待値を明確に伝達
- **段階的複雑性制御**: シンプルな実装から始めて段階的に機能を拡張
- **継続的フィードバックループ**: 品質メトリクスに基づく自動的な改善提案

#### TypeScript/Node.js 特化

- **厳格な型安全性**: never タイプや exactOptionalPropertyTypes を活用
- **パフォーマンス最適化**: PostgreSQL クエリ最適化と Node.js 効率化
- **エンタープライズ対応**: 10k+ユーザーを想定したスケーラビリティ

#### ドメイン駆動設計の全面採用

- **値オブジェクト中心**: プリミティブ型を避け、意味のある型を使用
- **集約による境界**: ビジネス不変条件の適切な管理
- **アーキテクチャ横断的適用**: どのアーキテクチャパターンでも DDD 概念を活用

#### 継続的品質改善

- **定量的測定**: 複雑度、カバレッジ、パフォーマンスの客観的評価
- **自動化されたフィードバック**: CI/CD パイプラインでの品質チェック
- **学習する組織**: メトリクス分析による継続的なベストプラクティス更新

### 実践への適用

プロジェクトの性質や要件、チームの成熟度に応じて、これらの原則を適切に適用し、継続的に改善していくことが重要です。特に Wishlist プロジェクトのような中規模アプリケーションでは、すべての原則を一度に適用するのではなく、以下の優先順位で段階的に導入することを推奨します：

1. **基本的な型安全性とドメインモデル**の確立
2. **パフォーマンス測定基盤**の導入
3. **AI 協調開発プロセス**の最適化
4. **継続的品質改善システム**の構築

---

**最終更新日**: 2025 年 7 月 12 日  
**バージョン**: 1.1  
**レビュー予定**: 2025 年 10 月 12 日  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境
