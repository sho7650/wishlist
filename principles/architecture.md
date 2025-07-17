# Claude Code ソフトウェアアーキテクチャ原則

## 📋 目次

### 📚 分野別ドキュメント

- **[基本原則](./architecture-core.md)** - 設計原則、AI協調開発、コーディング標準
- **[実装例とベストプラクティス](./architecture-implementation.md)** - DDD実装、パフォーマンス最適化、具体的コード例
- **[品質管理とメトリクス](./architecture-quality.md)** - 品質指標、継続的改善、技術債務管理
- **[トラブルシューティング](./architecture-troubleshooting.md)** - よくある問題と解決策、デバッグ手法

### 🛠️ 実践支援ドキュメント

- **[段階的導入ガイド](./getting-started.md)** - チーム規模別の導入戦略、8週間実装プラン
- **[プロンプトテンプレート集](./prompt-templates.md)** - Claude Code協働用の実証済みテンプレート

### 🎯 用途別クイックナビゲーション

#### 新規プロジェクト開始時
1. [基本原則](./architecture-core.md#基本原則) - 設計思想の理解
2. [アーキテクチャパターン](./architecture-core.md#アーキテクチャパターン) - 適切なパターン選択
3. [コーディング標準](./architecture-core.md#コーディング標準) - 開発ルール設定

#### 機能実装時
1. [DDD実践指針](./architecture-implementation.md#ドメイン駆動設計ddd実践指針) - ドメインモデリング
2. [AI協調開発フロー](./architecture-implementation.md#claude-code-ai-協調開発フロー) - Claude Code活用法
3. [現行プロジェクト適用例](./architecture-implementation.md#現行プロジェクトwishlist-appでの適用例) - 実装参考例

#### 品質向上時
1. [品質指標と測定](./architecture-quality.md#品質指標kpiと測定) - メトリクス収集
2. [技術債務管理](./architecture-quality.md#技術債務管理) - 債務の特定と解決
3. [継続的改善](./architecture-quality.md#継続的改善のフィードバックループ) - 自動化プロセス

#### 問題解決時
1. [よくある設計問題](./architecture-troubleshooting.md#よくある設計問題と解決策) - 典型的問題の対処
2. [パフォーマンス問題](./architecture-troubleshooting.md#5-パフォーマンス問題) - 性能改善手法
3. [エラーハンドリング](./architecture-troubleshooting.md#エラーハンドリングのベストプラクティス) - 堅牢性向上

### 🔍 キーワード別インデックス

#### A-D
- **AI協調開発**: [基本原則](./architecture-core.md#2-ai-協調型設計ai-collaborative-design), [実装フロー](./architecture-implementation.md#claude-code-ai-協調開発フロー)
- **API設計**: [実装例](./architecture-implementation.md#2-api-設計とフロントエンド連携)
- **DDD (ドメイン駆動設計)**: [実践指針](./architecture-implementation.md#ドメイン駆動設計ddd実践指針)
- **デバッグ**: [トレーシング](./architecture-troubleshooting.md#デバッグとトレーシング)

#### E-N  
- **エラーハンドリング**: [基本原則](./architecture-core.md#3-エラーハンドリングtypescriptnodejs), [ベストプラクティス](./architecture-troubleshooting.md#エラーハンドリングのベストプラクティス)
- **N+1クエリ**: [解決策](./architecture-implementation.md#n1-問題の解決), [診断](./architecture-troubleshooting.md#2-n1-クエリ問題の診断と解決)

#### P-T
- **パフォーマンス**: [最適化例](./architecture-implementation.md#パフォーマンス最適化事例), [監視](./architecture-quality.md#パフォーマンス測定)
- **プロンプト設計**: [基本原則](./architecture-core.md#プロンプト設計とコンテキスト管理), [最適化](./architecture-quality.md#claude-code-プロンプト最適化ガイド)
- **セキュリティ**: [原則](./architecture-core.md#セキュリティ原則)
- **技術債務**: [管理](./architecture-quality.md#技術債務管理)
- **テスト**: [戦略](./architecture-implementation.md#テスト戦略)
- **型安全性**: [TypeScript](./architecture-core.md#型安全性スコア), [問題解決](./architecture-troubleshooting.md#4-型安全性の問題)

### 📊 品質チェックリスト

#### コード品質
- [ ] サイクロマティック複雑度 < 10
- [ ] テストカバレッジ > 90%
- [ ] 重複コード < 5%
- [ ] any型使用を最小限に抑制

#### パフォーマンス
- [ ] API応答時間 95%ile < 200ms
- [ ] N+1クエリの排除
- [ ] メモリ使用量の安定性
- [ ] データベース接続プール効率性

#### 保守性
- [ ] ファイルサイズ < 500行
- [ ] 関数サイズ < 30行
- [ ] 依存関係の深さ < 5層
- [ ] 技術債務の定期的解決

## 概要

本ドキュメント群は、Claude Code（Claude 搭載の AI アシスタント開発環境）を使用した開発プロジェクトにおける、ソフトウェアアーキテクチャの設計原則とガイドラインを定義します。

### 📝 ドキュメント構成

従来の単一ドキュメント（4000行超）を、用途別に4つの専門ドキュメントに分割し、可読性と実用性を大幅に向上しました：

1. **基本原則** - 設計思想とコーディング標準の確立
2. **実装例** - 具体的なコード例とベストプラクティス
3. **品質管理** - メトリクス測定と継続的改善
4. **トラブルシューティング** - 問題解決と予防策

### 🚀 クイックスタート

#### 新規プロジェクト向け
1. **[基本原則](./architecture-core.md)** で設計思想を理解
2. **[実装例](./architecture-implementation.md)** でDDD実装パターンを学習
3. **[品質管理](./architecture-quality.md)** でメトリクス設定を構成

#### 既存プロジェクト改善向け
1. **[品質管理](./architecture-quality.md)** で現状分析
2. **[トラブルシューティング](./architecture-troubleshooting.md)** で問題解決
3. **[技術債務管理](./architecture-quality.md#技術債務管理)** で継続的改善

### 💡 活用ガイド

本アーキテクチャ原則は以下の順序で段階的に導入することを推奨します：

## Phase 1: 基本方針の確立（Week 1-2）

### 設計原則の理解
**参照**: [基本原則](./architecture-core.md#基本原則)

Claude Code を使用した開発における4つの基本原則：

1. **信頼性第一設計** - セキュリティとエラー対策の徹底
2. **AI協調型設計** - Claude Code との効果的な協働手法
3. **段階的複雑性管理** - 小さな単位からの段階的構築
4. **説明可能性** - 設計判断の文書化と可視化

### アーキテクチャパターンの選択
**参照**: [基本原則](./architecture-core.md#アーキテクチャパターン)

推奨パターン：
- **ヘキサゴナルアーキテクチャ** (推奨) - 複雑なビジネスロジックに最適
- **レイヤードアーキテクチャ** - CRUD中心のシンプルなアプリケーション
- **ドメイン駆動設計（DDD）** - 長期保守とチーム協働

## Phase 2: 実装パターンの習得（Week 3-4）

### DDD実装の実践
**参照**: [実装例](./architecture-implementation.md#ドメイン駆動設計ddd実践指針)

実装順序：
1. **値オブジェクト** の定義
2. **エンティティ** の設計
3. **集約** の境界設定
4. **リポジトリ** の実装

### パフォーマンス最適化
**参照**: [実装例](./architecture-implementation.md#パフォーマンス最適化事例)

重要な最適化項目：
- N+1クエリの解決
- セッション管理の効率化
- 楽観的UI実装
- データベース設計最適化

## Phase 3: 品質管理体制の構築（Week 5-6）

### 品質メトリクスの設定
**参照**: [品質管理](./architecture-quality.md#品質指標kpiと測定)

基本KPI：
- コード複雑度 < 10
- テストカバレッジ > 90%
- API応答時間 < 200ms
- any型使用の最小化

### 継続的改善プロセス
**参照**: [品質管理](./architecture-quality.md#継続的改善プロセス)

自動化項目：
- コード品質チェック
- パフォーマンス監視
- 技術債務検出
- 改善提案生成

## Phase 4: 問題解決能力の向上（Week 7-8）

### トラブルシューティング習得
**参照**: [トラブルシューティング](./architecture-troubleshooting.md)

よくある問題：
- ドメインロジックの散在
- N+1クエリ問題
- 型安全性の問題
- AI協調のコミュニケーション改善

## 実践への適用

### Wishlist プロジェクトでの実装例
**詳細**: [現行プロジェクト適用例](./architecture-implementation.md#現行プロジェクトwishlist-appでの適用例)

具体的な実装：
- Wishエンティティの設計
- 応援機能のドメインモデル
- PostgreSQL最適化
- 楽観的UI対応

### Claude Code 協働のベストプラクティス
**詳細**: [AI協調開発フロー](./architecture-implementation.md#claude-code-ai-協調開発フロー)

効果的な協働手法：
- 構造化プロンプト設計
- 段階的実装アプローチ
- 品質向上サイクル
- フィードバックループ

## 継続的改善

### 技術債務の管理
**詳細**: [技術債務管理](./architecture-quality.md#技術債務管理)

体系的なアプローチ：
- 自動検出システム
- 優先順位付け
- 段階的解決計画
- ROI測定

### プロンプト最適化
**詳細**: [プロンプト最適化ガイド](./architecture-quality.md#claude-code-プロンプト最適化ガイド)

効果的なパターン：
- コンテキスト設定テンプレート
- 段階的複雑性制御
- 品質向上サイクル
- 効果測定

## まとめ

これらの原則は、Claude Code を使用した TypeScript/Node.js + PostgreSQL 環境での開発プロジェクトにおいて、保守性が高く、拡張性があり、型安全性を重視したソフトウェアアーキテクチャを構築するためのガイドラインです。

### 実践への適用

プロジェクトの性質や要件、チームの成熟度に応じて、これらの原則を適切に適用し、継続的に改善していくことが重要です。特に Wishlist プロジェクトのような中規模アプリケーションでは、以下の優先順位で段階的に導入することを推奨します：

1. **[基本的な型安全性とドメインモデル](./architecture-core.md)** の確立
2. **[パフォーマンス測定基盤](./architecture-quality.md)** の導入  
3. **[AI 協調開発プロセス](./architecture-implementation.md)** の最適化
4. **[継続的品質改善システム](./architecture-quality.md)** の構築

各段階で具体的な実装例とトラブルシューティング情報を参照し、着実に品質向上を図ってください。

---

**📋 関連ドキュメント**:
- **[基本原則](./architecture-core.md)** - 設計原則、AI協調開発、コーディング標準
- **[実装例とベストプラクティス](./architecture-implementation.md)** - DDD実装、パフォーマンス最適化、具体的コード例  
- **[品質管理とメトリクス](./architecture-quality.md)** - 品質指標、継続的改善、技術債務管理
- **[トラブルシューティング](./architecture-troubleshooting.md)** - よくある問題と解決策、デバッグ手法
- **[段階的導入ガイド](./getting-started.md)** - チーム規模別の導入戦略
- **[プロンプトテンプレート集](./prompt-templates.md)** - Claude Code協働用テンプレート

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境
