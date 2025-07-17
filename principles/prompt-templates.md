# Claude Code プロンプトテンプレート集

## 📋 概要

本ドキュメントでは、Claude Code との効果的な協働を実現するための、実績のあるプロンプトテンプレート集を提供します。各テンプレートは実際のWishlistプロジェクトで検証済みで、高品質なコード生成と効率的な開発を支援します。

## 🎯 テンプレート分類

### 📚 基本テンプレート
- [汎用実装テンプレート](#汎用実装テンプレート)
- [コードレビューテンプレート](#コードレビューテンプレート)
- [リファクタリングテンプレート](#リファクタリングテンプレート)

### 🏗️ アーキテクチャ特化
- [DDD実装テンプレート](#ddd実装テンプレート)
- [パフォーマンス最適化テンプレート](#パフォーマンス最適化テンプレート)
- [API設計テンプレート](#api設計テンプレート)

### 🔧 問題解決特化
- [バグ修正テンプレート](#バグ修正テンプレート)
- [技術債務解決テンプレート](#技術債務解決テンプレート)
- [トラブルシューティングテンプレート](#トラブルシューティングテンプレート)

### 📊 品質向上
- [テスト実装テンプレート](#テスト実装テンプレート)
- [品質改善テンプレート](#品質改善テンプレート)
- [ドキュメント作成テンプレート](#ドキュメント作成テンプレート)

## 基本テンプレート

### 汎用実装テンプレート

```typescript
const GENERAL_IMPLEMENTATION_TEMPLATE = `
## Context
プロジェクト: Wishlist アプリケーション
技術スタック: TypeScript, Node.js, PostgreSQL, Express
アーキテクチャ: ヘキサゴナル + DDD

## Current State
[現在の実装状況を具体的に記載]

## Goal
[達成したい明確な目標]

## Requirements
### Functional Requirements
1. [機能要件1]
2. [機能要件2]
3. [機能要件3]

### Non-Functional Requirements
- API応答時間: 95%ile < 200ms
- 型安全性: 厳格なTypeScript（any型使用禁止）
- テストカバレッジ: > 90%
- コード複雑度: < 10

## Technical Constraints
- PostgreSQL最適化必須
- DDD原則遵守（値オブジェクト、エンティティ、集約）
- 既存API互換性維持
- セッション管理: express-session

## Expected Output
1. [期待する成果物1]
2. [期待する成果物2]
3. [期待する成果物3]

## Validation Criteria
- [ ] TypeScript型チェック通過
- [ ] ユニットテスト実装済み
- [ ] ESLintルール遵守
- [ ] パフォーマンス基準達成

段階的に実装し、各ステップで動作確認を行ってください。
完成後は実装の説明と、想定される課題があれば併せて教えてください。
`;

// 使用例
const wishSharingPrompt = GENERAL_IMPLEMENTATION_TEMPLATE
  .replace('[現在の実装状況を具体的に記載]', 'Wishエンティティは基本的なCRUD機能のみ実装済み')
  .replace('[達成したい明確な目標]', 'ユーザー間での願い共有機能の実装')
  .replace('[機能要件1]', 'ユーザーは自分の願いを他のユーザーと共有できる')
  .replace('[機能要件2]', '共有された願いは読み取り専用で表示される')
  .replace('[機能要件3]', '共有リンクには有効期限を設定できる');
```

### コードレビューテンプレート

```typescript
const CODE_REVIEW_TEMPLATE = `
## Context
コードレビュー対象: [ファイル名またはPR番号]
レビュー観点: 品質、セキュリティ、パフォーマンス、保守性

## Code to Review
[レビュー対象のコードを貼り付け]

## Review Criteria
### コード品質
- [ ] 単一責任原則の遵守
- [ ] 適切な命名規則
- [ ] サイクロマティック複雑度 < 10
- [ ] DRY原則の遵守

### 型安全性
- [ ] 厳格なTypeScript型定義
- [ ] any型の使用回避
- [ ] null/undefinedの適切な処理
- [ ] 型ガードの適用

### パフォーマンス
- [ ] N+1クエリの回避
- [ ] 適切なインデックス使用
- [ ] メモリリークの防止
- [ ] 非同期処理の効率性

### セキュリティ
- [ ] 入力検証の実装
- [ ] SQLインジェクション対策
- [ ] XSS対策
- [ ] 適切な認証・認可

## Expected Output
1. 問題点の指摘と改善提案
2. ベストプラクティスへの変更案
3. セキュリティリスクの評価
4. パフォーマンス改善案
5. 改善されたコードの提供

コードの良い点も含めて、建設的なフィードバックをお願いします。
`;
```

### リファクタリングテンプレート

```typescript
const REFACTORING_TEMPLATE = `
## Context
リファクタリング対象: [対象コードの説明]
現在の問題: [具体的な問題点]

## Current Code
[現在のコードを貼り付け]

## Refactoring Goals
### 品質向上
- [ ] サイクロマティック複雑度削減（目標: < 10）
- [ ] 重複コード排除
- [ ] 関数・クラスサイズ最適化（< 30行）
- [ ] 責務分離の改善

### 保守性向上
- [ ] 可読性改善
- [ ] テスタビリティ向上
- [ ] 拡張性確保
- [ ] 依存関係整理

## Technical Approach
- 段階的リファクタリング（一度に大きく変更しない）
- 既存機能の動作保持
- テストによる安全性確保
- DDD原則の適用

## Expected Output
1. リファクタリング計画（段階別）
2. 改善されたコード
3. 変更点の説明
4. 追加・更新すべきテスト
5. 改善効果の定量評価

既存の機能を壊さずに、段階的に改善してください。
`;
```

## アーキテクチャ特化テンプレート

### DDD実装テンプレート

```typescript
const DDD_IMPLEMENTATION_TEMPLATE = `
## Context
ドメイン駆動設計による実装
対象ドメイン: [ドメイン名]
ビジネスコンテキスト: [ビジネス背景]

## Domain Analysis
### ユビキタス言語
[ドメインエキスパートと共有する用語集]

### ビジネスルール
1. [重要なビジネスルール1]
2. [重要なビジネスルール2]
3. [重要なビジネスルール3]

### 集約設計
- 集約ルート: [候補エンティティ]
- 不変条件: [維持すべき制約]
- 境界: [集約の境界基準]

## Implementation Requirements
### 値オブジェクト
- [識別子] (例: WishId, UserId)
- [属性値] (例: WishContent, SupportCount)
- [ビジネス概念] (例: SessionId, Priority)

### エンティティ
- [集約ルート候補]
- [ライフサイクル管理が必要なオブジェクト]

### ドメインサービス
- [複数の集約にまたがるビジネスロジック]

### ドメインイベント
- [重要なビジネスイベント]

## Expected Output
1. 値オブジェクトの実装（TypeScript）
2. エンティティクラスの実装
3. 集約ルートの実装
4. ドメインサービスの実装
5. リポジトリインターフェース
6. ドメインイベント定義
7. ユニットテスト（ビジネスルール検証）

DDD原則に厳密に従い、ビジネスロジックをドメイン層に適切に配置してください。
`;
```

### パフォーマンス最適化テンプレート

```typescript
const PERFORMANCE_OPTIMIZATION_TEMPLATE = `
## Context
パフォーマンス最適化対象: [対象システム/機能]
現在のパフォーマンス: [現状の測定値]
目標パフォーマンス: [達成目標]

## Performance Analysis
### 現在の問題
- [ ] N+1クエリ問題
- [ ] 遅いデータベースクエリ
- [ ] メモリ使用量の増大
- [ ] CPU使用率の高騰
- [ ] レスポンス時間の悪化

### 測定データ
[現在のパフォーマンス測定結果を貼り付け]

## Optimization Targets
### Database Performance
- クエリ最適化
- インデックス設計改善
- 接続プール最適化
- バッチ処理導入

### Application Performance
- メモリ使用量削減
- CPU効率化
- キャッシュ戦略
- 非同期処理最適化

### API Performance
- レスポンス時間短縮
- スループット向上
- 楽観的UI対応
- CDN活用

## Technical Constraints
- PostgreSQL使用（バージョン指定）
- Node.js環境（メモリ制限考慮）
- 既存API仕様維持
- データ整合性保証

## Expected Output
1. パフォーマンス分析結果
2. 最適化戦略の提案
3. 改善されたコード実装
4. データベースインデックス設計
5. パフォーマンステスト実装
6. ベンチマーク結果比較
7. 監視・アラート設定提案

目標値を数値で明確に示し、改善効果を定量的に評価してください。
`;
```

### API設計テンプレート

```typescript
const API_DESIGN_TEMPLATE = `
## Context
API設計対象: [API名称]
用途: [API の目的・用途]
想定ユーザー: [フロントエンド、モバイル、外部システム等]

## API Requirements
### 機能要件
1. [機能1] - [詳細説明]
2. [機能2] - [詳細説明]
3. [機能3] - [詳細説明]

### 非機能要件
- レスポンス時間: 95%ile < 200ms
- 同時接続数: 1000+ ユーザー
- 可用性: 99.9%
- セキュリティ: OAuth 2.0対応

## API Design Principles
### RESTful設計
- 適切なHTTPメソッド使用
- リソース指向URL設計
- ステータスコードの適切な使用
- 冪等性の考慮

### 型安全性
- TypeScript型定義提供
- 入力検証の徹底
- レスポンス形式の統一
- エラーレスポンスの標準化

### 楽観的UI対応
- 即座のレスポンス
- 非同期処理対応
- エラー時のロールバック
- リアルタイム更新（WebSocket）

## Expected Output
1. OpenAPI仕様書
2. TypeScript型定義
3. APIエンドポイント実装
4. 入力検証実装
5. エラーハンドリング実装
6. レート制限実装
7. セキュリティミドルウェア
8. API使用例・ドキュメント
9. 統合テスト

フロントエンドとの型安全な連携を重視した設計にしてください。
`;
```

## 問題解決特化テンプレート

### バグ修正テンプレート

```typescript
const BUG_FIX_TEMPLATE = `
## Bug Report
### 発生状況
- 環境: [開発/ステージング/本番]
- 発生日時: [タイムスタンプ]
- 頻度: [常時/間欠的/特定条件]
- 影響範囲: [ユーザー数/機能範囲]

### 症状
[バグの具体的な症状を記載]

### 再現手順
1. [再現手順1]
2. [再現手順2]
3. [再現手順3]

### 期待される動作
[本来あるべき動作]

### エラーログ
[関連するエラーログを貼り付け]

## Investigation Request
### 原因分析
- コードレビュー
- ログ分析
- データ整合性チェック
- パフォーマンス影響調査

### 影響調査
- セキュリティリスク評価
- データ損失リスク評価
- ユーザー体験への影響
- システム安定性への影響

## Fix Requirements
### 修正方針
- 根本原因の解決
- 副作用の最小化
- テストカバレッジ向上
- 再発防止策の実装

### 品質保証
- ユニットテスト追加
- 統合テスト実施
- 回帰テスト実行
- パフォーマンステスト

## Expected Output
1. 根本原因の特定と分析
2. 修正されたコード
3. 追加・更新テスト
4. 修正検証手順
5. 再発防止策の提案
6. 関連する改善提案

段階的に修正を行い、各段階で影響を確認してください。
`;
```

### 技術債務解決テンプレート

```typescript
const TECHNICAL_DEBT_TEMPLATE = `
## Technical Debt Analysis
### 債務の種類
- [ ] コード品質（複雑度、重複）
- [ ] アーキテクチャ（設計問題）
- [ ] パフォーマンス（性能問題）
- [ ] セキュリティ（脆弱性）
- [ ] テスト（カバレッジ不足）
- [ ] ドキュメント（不足・古い情報）

### 現在の状況
[技術債務の具体的な内容を記載]

### 影響評価
- 開発速度への影響: [High/Medium/Low]
- バグ発生リスク: [High/Medium/Low]
- 保守コスト: [High/Medium/Low]
- 新機能開発への障害: [High/Medium/Low]

## Resolution Strategy
### 優先順位付け
1. [最優先の債務] - 理由: [影響度・緊急度]
2. [次優先の債務] - 理由: [影響度・緊急度]
3. [その他の債務] - 理由: [影響度・緊急度]

### リソース見積もり
- 予想作業時間: [時間]
- 必要スキル: [技術要件]
- リスク要因: [想定リスク]

## Implementation Plan
### Phase 1: 緊急対応
[即座に対応すべき項目]

### Phase 2: 構造改善
[アーキテクチャ・設計の改善]

### Phase 3: 予防策
[再発防止・品質向上]

## Expected Output
1. 段階的解決計画
2. 改善されたコード
3. リファクタリング手順
4. 品質向上の定量評価
5. 予防策の実装
6. ドキュメント更新
7. チーム教育資料

ROIを意識した効率的な解決策を提案してください。
`;
```

### トラブルシューティングテンプレート

```typescript
const TROUBLESHOOTING_TEMPLATE = `
## Issue Description
### 問題の概要
[問題の簡潔な説明]

### 発生タイミング
- 最初の発生: [日時]
- 発生パターン: [規則性があるか]
- トリガー: [何をきっかけに発生するか]

### 環境情報
- OS: [オペレーティングシステム]
- Node.js: [バージョン]
- PostgreSQL: [バージョン]
- その他依存関係: [関連ライブラリ]

## Investigation Areas
### システムレベル
- [ ] CPU使用率
- [ ] メモリ使用量
- [ ] ディスク容量
- [ ] ネットワーク接続

### アプリケーションレベル
- [ ] エラーログ
- [ ] パフォーマンスログ
- [ ] データベースログ
- [ ] アクセスログ

### コードレベル
- [ ] 最近の変更
- [ ] 設定変更
- [ ] 依存関係更新
- [ ] データベーススキーマ変更

## Diagnostic Request
### ログ分析
[関連するログを貼り付け]

### 監視データ
[監視ツールからのデータ]

### 再現テスト
[再現可能な手順]

## Resolution Approach
### 即時対応
- 緊急対応策
- 影響範囲の制限
- ユーザー通知

### 根本対応
- 原因特定
- 恒久対策
- 再発防止

## Expected Output
1. 問題の根本原因特定
2. 即時対応策の提案
3. 恒久対策の実装計画
4. 監視・アラート改善案
5. 運用手順書の更新
6. 類似問題の予防策

システム全体への影響を最小限に抑えた解決策を提案してください。
`;
```

## 品質向上テンプレート

### テスト実装テンプレート

```typescript
const TEST_IMPLEMENTATION_TEMPLATE = `
## Test Target
### テスト対象
- 機能: [テスト対象の機能]
- コンポーネント: [クラス/関数名]
- スコープ: [Unit/Integration/E2E]

### テスト要件
- カバレッジ目標: 90%以上
- テスト種別: [Unit/Integration/E2E]
- テストデータ: [必要なテストデータ]

## Test Design
### テストケース分類
#### Happy Path（正常系）
1. [正常系テストケース1]
2. [正常系テストケース2]
3. [正常系テストケース3]

#### Edge Cases（境界値）
1. [境界値テストケース1]
2. [境界値テストケース2]
3. [境界値テストケース3]

#### Error Cases（異常系）
1. [異常系テストケース1]
2. [異常系テストケース2]
3. [異常系テストケース3]

### ビジネスルールテスト
[重要なビジネスロジックの検証項目]

## Technical Requirements
### フレームワーク
- Jest（ユニットテスト）
- Supertest（API統合テスト）
- TestContainers（データベーステスト）

### テストデータ
- ファクトリーパターン使用
- データのクリーンアップ
- 独立性の確保

### モック戦略
- 外部依存のモック
- データベースのモック
- 時間に依存する処理のモック

## Expected Output
1. 包括的なテストスイート
2. テストデータファクトリー
3. モック実装
4. テスト実行環境設定
5. カバレッジレポート
6. 継続的テスト実行設定
7. テスト実行ドキュメント

保守しやすく、信頼性の高いテストを実装してください。
`;
```

### 品質改善テンプレート

```typescript
const QUALITY_IMPROVEMENT_TEMPLATE = `
## Quality Assessment
### 現在の品質状況
[品質メトリクスの現状を記載]

### 品質目標
- コード複雑度: < 10
- テストカバレッジ: > 90%
- any型使用: < 5%
- 重複コード: < 5%
- API応答時間: < 200ms

## Improvement Areas
### コード品質
- [ ] 複雑度削減
- [ ] 重複コード排除
- [ ] 命名規則統一
- [ ] 型安全性向上

### アーキテクチャ品質
- [ ] 責務分離改善
- [ ] 依存関係整理
- [ ] 抽象化レベル調整
- [ ] 設計パターン適用

### パフォーマンス品質
- [ ] データベースクエリ最適化
- [ ] メモリ使用量削減
- [ ] CPU効率化
- [ ] ネットワーク最適化

## Implementation Strategy
### 段階的改善
1. Phase 1: クリティカルな問題の解決
2. Phase 2: 構造的な改善
3. Phase 3: 予防策の実装

### 自動化
- 品質チェックの自動化
- 継続的測定の実装
- アラート設定
- レポート生成

## Measurement & Monitoring
### 品質メトリクス
- 定量的指標の測定
- 傾向分析
- 改善効果の評価
- ベンチマーク比較

### 継続的改善
- 定期レビューサイクル
- フィードバックループ
- ベストプラクティス更新
- チーム学習機会

## Expected Output
1. 品質改善計画
2. 改善されたコード
3. 品質測定システム
4. 自動化ツール設定
5. 継続的改善プロセス
6. 品質ダッシュボード
7. チーム教育資料

段階的で持続可能な品質改善システムを構築してください。
`;
```

### ドキュメント作成テンプレート

```typescript
const DOCUMENTATION_TEMPLATE = `
## Documentation Request
### ドキュメント種類
- [ ] API仕様書
- [ ] アーキテクチャドキュメント
- [ ] 運用手順書
- [ ] 開発者ガイド
- [ ] トラブルシューティングガイド

### 対象読者
- [ ] 新規参加開発者
- [ ] 既存チームメンバー
- [ ] 運用担当者
- [ ] 外部ステークホルダー

## Content Requirements
### 必須項目
1. [必須項目1]
2. [必須項目2]
3. [必須項目3]

### 詳細レベル
- 概要: [高レベルな説明が必要]
- 詳細: [実装レベルの詳細が必要]
- 手順: [ステップバイステップが必要]

## Structure Guidelines
### ドキュメント構成
- 目次
- 概要
- 詳細説明
- 実装例
- FAQ
- 参考資料

### 品質基準
- 正確性: 最新情報の反映
- 完全性: 必要情報の網羅
- 明確性: 分かりやすい説明
- 実用性: 実際に使える内容

## Technical Specifications
### フォーマット
- Markdown形式
- 図表の活用
- コード例の充実
- リンク構造の整備

### 保守性
- バージョン管理
- 更新プロセス
- レビューサイクル
- 品質チェック

## Expected Output
1. 構造化されたドキュメント
2. 実装例・コードサンプル
3. 図表・ダイアグラム
4. FAQ・トラブルシューティング
5. 更新・保守手順
6. テンプレート・チェックリスト

読者が実際に活用できる、実用的なドキュメントを作成してください。
`;
```

## 🎯 テンプレート活用ガイド

### 効果的な使い方

#### 1. 適切なテンプレート選択
```typescript
const templateSelector = {
  // 新機能開発
  newFeature: GENERAL_IMPLEMENTATION_TEMPLATE,
  
  // 品質改善
  qualityIssue: QUALITY_IMPROVEMENT_TEMPLATE,
  
  // パフォーマンス問題
  performanceIssue: PERFORMANCE_OPTIMIZATION_TEMPLATE,
  
  // バグ対応
  bugFix: BUG_FIX_TEMPLATE,
  
  // アーキテクチャ設計
  domainDesign: DDD_IMPLEMENTATION_TEMPLATE,
};
```

#### 2. テンプレートのカスタマイズ
```typescript
// プロジェクト固有の情報を反映
const customizeTemplate = (baseTemplate: string, projectInfo: ProjectInfo) => {
  return baseTemplate
    .replace('[プロジェクト名]', projectInfo.name)
    .replace('[技術スタック]', projectInfo.techStack.join(', '))
    .replace('[アーキテクチャ]', projectInfo.architecture);
};
```

#### 3. 段階的な活用
```typescript
// Phase別のテンプレート組み合わせ
const phaseTemplates = {
  phase1: [GENERAL_IMPLEMENTATION_TEMPLATE, DDD_IMPLEMENTATION_TEMPLATE],
  phase2: [PERFORMANCE_OPTIMIZATION_TEMPLATE, API_DESIGN_TEMPLATE],
  phase3: [QUALITY_IMPROVEMENT_TEMPLATE, TEST_IMPLEMENTATION_TEMPLATE],
  phase4: [BUG_FIX_TEMPLATE, TROUBLESHOOTING_TEMPLATE],
};
```

### 品質評価指標

#### プロンプト効果性の測定
```typescript
interface PromptEffectiveness {
  // 出力品質
  codeQuality: number;        // 1-10スケール
  requirementsCoverage: number; // 要件カバレッジ%
  firstAttemptSuccess: boolean; // 初回成功率
  
  // 効率性
  responseTime: number;       // 応答時間（秒）
  iterationCount: number;     // 反復回数
  modificationRate: number;   // 修正率%
  
  // 実用性
  implementationReady: boolean; // そのまま実装可能
  testCoverage: number;        // テストカバレッジ%
  documentationQuality: number; // ドキュメント品質
}
```

### 継続的改善

#### テンプレート進化プロセス
1. **使用実績の収集** - 効果的なパターンの特定
2. **フィードバック分析** - 改善点の洗い出し
3. **ベストプラクティス更新** - 成功事例の反映
4. **定期レビュー** - 月次でのテンプレート見直し

#### 成功事例の蓄積
```typescript
interface SuccessPattern {
  context: string;           // 適用状況
  template: string;          // 使用テンプレート
  customizations: string[];  // カスタマイズ内容
  outcome: string;           // 成果
  lessons: string[];         // 学習事項
}
```

## 📚 関連リソース

### Claude Code 協調ベストプラクティス
- **[AI協調開発フロー](./architecture-implementation.md#claude-code-ai-協調開発フロー)**
- **[プロンプト最適化ガイド](./architecture-quality.md#claude-code-プロンプト最適化ガイド)**
- **[品質向上サイクル](./architecture-quality.md#継続的改善のフィードバックループ)**

### 実装例とコード参考
- **[DDD実装例](./architecture-implementation.md#具体的実装例)**
- **[パフォーマンス最適化事例](./architecture-implementation.md#パフォーマンス最適化事例)**
- **[トラブルシューティング事例](./architecture-troubleshooting.md)**

### 段階的導入支援
- **[導入ガイド](./getting-started.md)**
- **[チーム規模別戦略](./getting-started.md#チーム規模別適用戦略)**
- **[進捗評価指標](./getting-started.md#進捗評価指標)**

---

**📋 関連ドキュメント**:
- **[基本原則](./architecture-core.md)** - 設計思想の詳細
- **[実装例](./architecture-implementation.md)** - 具体的な実装方法
- **[品質管理](./architecture-quality.md)** - メトリクスと改善手法
- **[トラブルシューティング](./architecture-troubleshooting.md)** - 問題解決事例
- **[導入ガイド](./getting-started.md)** - 段階的導入支援

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境