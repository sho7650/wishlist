# Claude Code ソフトウェアアーキテクチャ原則 - 品質管理とメトリクス

## 概要

本ドキュメントでは、Claude Code を使用した開発プロジェクトにおける品質管理手法、測定指標、継続的改善プロセスについて詳述します。

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
```

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
```

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

### パフォーマンス測定

#### データベースクエリパフォーマンス

```typescript
// クエリパフォーマンス監視
export class PerformanceMonitoringRepository implements WishRepository {
  constructor(
    private readonly underlying: WishRepository,
    private readonly logger: Logger
  ) {}

  async findByUserId(userId: UserId): Promise<Wish | null> {
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

#### 継続的パフォーマンス監視

```typescript
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

### 保守性測定

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
export interface StrictWishRepository {
  findByUserId(userId: UserId): Promise<Wish | null>;
  save(wish: Wish): Promise<void>;
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

### 継続的改善のフィードバックループ

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

### Claude Code 特化の品質向上戦略

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
```

### 継続的改善プロセス

#### 自動化された改善サイクル

```typescript
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
      improvements.codeQuality.complexityReduction * 0.1;
    const performanceGain =
      improvements.performance.responseTimeImprovement * 0.05;

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
}
```

## Claude Code プロンプト最適化ガイド

### 効果的なプロンプト設計パターン

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

#### コード品質向上サイクル

```typescript
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
```

---

**関連ドキュメント**:
- [基本原則](./architecture-core.md)
- [実装例とベストプラクティス](./architecture-implementation.md)
- [トラブルシューティング](./architecture-troubleshooting.md)

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境