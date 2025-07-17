# Claude Code ソフトウェアアーキテクチャ原則 - 基本原則

## 概要

本ドキュメントは、Claude Code（Claude 搭載の AI アシスタント開発環境）を使用した開発プロジェクトにおける、基本的なソフトウェアアーキテクチャの設計原則とガイドラインを定義します。

## 基本原則

### 1. 信頼性第一設計（Reliability-First Design）

#### セキュアバイコーディング（Secure by Coding）

安全なアプリケーション開発を実現するため、設計・実装の全段階でセキュリティを最優先に考慮する：

**設計段階でのセキュリティ組み込み**

- **脅威モデリング**: 想定される攻撃手法を事前に分析し、対策を設計に組み込む
- **最小権限の原則**: 必要最小限の権限のみを付与する設計
- **多層防御**: 単一障害点を避け、複数のセキュリティ層で保護
- **フェイルセーフ**: 障害時に安全側に倒れる設計

**コーディング段階でのセキュリティ実装**

- **入力検証**: 全ての外部入力に対する厳格な検証とサニタイゼーション
- **出力エスケープ**: XSS 攻撃防止のための適切なエスケープ処理
- **SQL インジェクション対策**: パラメータ化クエリの徹底使用
- **認証・認可**: 強固な認証メカニズムと適切な認可制御

**暗号化とデータ保護**

- **保存時暗号化**: 機密データの暗号化保存
- **転送時暗号化**: HTTPS/TLS 通信の徹底
- **鍵管理**: 暗号化キーの安全な管理と定期的なローテーション
- **個人情報保護**: GDPR、CCPA 等の規制遵守

#### 信頼性確保のための設計原則

- **冗長性**: 単一障害点の排除と冗長化
- **監視可能性**: 異常検知とアラートの仕組み
- **復旧可能性**: 障害からの迅速な復旧メカニズム
- **テスタビリティ**: 包括的なテストによる品質保証

### 2. AI 協調型設計（AI-Collaborative Design）

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
```

#### AI との効果的な対話手法

- **明確な指示出し**: 曖昧さを排除した具体的な要求
- **段階的複雑性制御**: シンプルな実装から開始し、徐々に機能を拡張
- **継続的なフィードバック**: 生成されたコードのレビューと改善指示

#### コンテキスト維持戦略

- **プロジェクト設定の文書化**: README.md に AI 協働のためのガイドラインを記載
- **コード規約の明示**: ESLint/Prettier 設定と AI への指示の整合性確保
- **ドメイン知識の蓄積**: ビジネスルールと要件を段階的に AI に教育

### 3. 段階的複雑性管理（Incremental Complexity Management）

- **小さな単位での開発**: 機能を小さなコンポーネントに分割し、段階的に構築する
- **反復的改善**: AI フィードバックを活用した継続的なコード改善を行う
- **プロトタイプ優先**: 完璧を求めず、動作するプロトタイプから始める

### 4. 説明可能性（Explainability）

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
```

## 依存関係管理

### 1. 依存性注入（Dependency Injection）

```typescript
class OrderService {
  constructor(
    private readonly paymentGateway: PaymentGateway,
    private readonly notificationService: NotificationService
  ) {}
}
```

### 2. 抽象化の活用

```typescript
interface PaymentGateway {
  processPayment(amount: number, cardInfo: CardInfo): Promise<PaymentResult>;
}
```

### 3. 設定管理

- **環境変数**: 設定値は環境変数で管理
- **設定ファイル**: 複雑な設定は構造化ファイル（YAML、JSON）で管理
- **デフォルト値**: 必須でない設定には適切なデフォルト値を設定

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

---

**関連ドキュメント**:
- [実装例とベストプラクティス](./architecture-implementation.md)
- [品質管理とメトリクス](./architecture-quality.md)
- [トラブルシューティング](./architecture-troubleshooting.md)

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境