# Claude Code ソフトウェアアーキテクチャ原則 - 実装例とベストプラクティス

## 概要

本ドキュメントでは、[基本原則](./architecture-core.md) で定義された設計原則を、TypeScript/Node.js + PostgreSQL 環境において実際に適用する方法を、具体的なコード例とベストプラクティスで説明します。

## ドメイン駆動設計（DDD）実践指針

### 1. 戦略的設計

#### 境界づけられたコンテキスト（Bounded Context）

```typescript
// 注文コンテキスト
class Order {
  constructor(
    private readonly orderId: OrderId,
    private readonly customerId: CustomerId
  ) {
    this.items = [];
    this.status = OrderStatus.PENDING;
  }
}

// 在庫コンテキスト
class Product {
  constructor(
    private readonly productId: ProductId,
    private stockQuantity: number
  ) {}
}
```

#### コンテキストマップ

- **共有カーネル**: 共通のドメインモデルを共有
- **顧客・供給者**: 上流・下流の関係を明確化
- **適合者**: 外部システムとのインターフェース層

### 2. 戦術的設計

#### エンティティ（Entity）

```typescript
class Customer {
  constructor(
    private readonly _customerId: CustomerId,
    private readonly _email: EmailAddress
  ) {
    this._orders = [];
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  placeOrder(order: Order): void {
    // ビジネスルールの実装
    if (!this._canPlaceOrder()) {
      throw new DomainException("顧客は注文を行うことができません");
    }
    this._orders.push(order);
  }

  private _canPlaceOrder(): boolean {
    // ビジネスルールの実装
    return this._orders.length < 10;
  }
}
```

#### 値オブジェクト（Value Object）

```typescript
interface Money {
  readonly amount: number;
  readonly currency: string;
}

export const Money = {
  create: (amount: number, currency: string): Money => {
    if (amount < 0) {
      throw new ValueError("金額は負の値にできません");
    }
    if (!currency) {
      throw new ValueError("通貨は必須です");
    }
    return { amount, currency };
  },

  add: (a: Money, b: Money): Money => {
    if (a.currency !== b.currency) {
      throw new ValueError("異なる通貨同士は加算できません");
    }
    return Money.create(a.amount + b.amount, a.currency);
  },

  equals: (a: Money, b: Money): boolean => {
    return a.amount === b.amount && a.currency === b.currency;
  }
};
```

#### 集約（Aggregate）

```typescript
class Order {  // 集約ルート
  private _domainEvents: DomainEvent[] = [];

  constructor(
    private readonly _orderId: OrderId,
    private readonly _customerId: CustomerId
  ) {
    this._items = [];
    this._status = OrderStatus.PENDING;
    this._total = Money.create(0, "JPY");
  }

  addItem(productId: ProductId, quantity: number, price: Money): void {
    // 不変条件の維持
    if (this._status !== OrderStatus.PENDING) {
      throw new DomainException("確定済みの注文には商品を追加できません");
    }

    const item = OrderItem.create(productId, quantity, price);
    this._items.push(item);
    this._recalculateTotal();
  }

  confirm(): void {
    if (this._items.length === 0) {
      throw new DomainException("商品のない注文は確定できません");
    }
    this._status = OrderStatus.CONFIRMED;
    
    // ドメインイベントの発行
    this._domainEvents.push(
      new OrderConfirmedEvent(this._orderId, this._customerId, this._total)
    );
  }

  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  private _recalculateTotal(): void {
    this._total = this._items.reduce(
      (total, item) => Money.add(total, item.subtotal),
      Money.create(0, "JPY")
    );
  }
}
```

#### ドメインサービス（Domain Service）

```typescript
class PricingService {
  constructor(private readonly discountRepository: DiscountRepository) {}

  calculateOrderPrice(order: Order, customer: Customer): Money {
    const basePrice = order.calculateBasePrice();
    const discount = this.discountRepository.findApplicableDiscount(customer);
    return Money.subtract(basePrice, discount.calculateDiscount(basePrice));
  }
}
```

#### リポジトリ（Repository）

```typescript
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(orderId: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
}

// 実装例
class PostgreSQLOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // 注文の保存
      await client.query(
        'INSERT INTO orders (id, customer_id, status, total_amount, total_currency) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status',
        [order.id.value, order.customerId.value, order.status, order.total.amount, order.total.currency]
      );

      // アイテムの保存
      await this.saveOrderItems(client, order);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(orderId: OrderId): Promise<Order | null> {
    const result = await this.pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId.value]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToOrder(result.rows[0]);
  }

  private mapRowToOrder(row: any): Order {
    // データベース行からドメインオブジェクトへのマッピング
    const order = Order.reconstruct(
      OrderId.fromString(row.id),
      CustomerId.fromString(row.customer_id),
      row.status,
      Money.create(row.total_amount, row.total_currency)
    );
    return order;
  }
}
```

### 3. ドメインイベント

#### イベントの定義

```typescript
interface DomainEvent {
  readonly occurredAt: Date;
  readonly eventId: string;
}

class OrderConfirmedEvent implements DomainEvent {
  readonly occurredAt: Date = new Date();
  readonly eventId: string = crypto.randomUUID();

  constructor(
    public readonly orderId: OrderId,
    public readonly customerId: CustomerId,
    public readonly totalAmount: Money
  ) {}
}
```

#### イベントの発行・処理

```typescript
interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => Promise<void>
  ): void;
}

class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async publish(event: DomainEvent): Promise<void> {
    const eventType = event.constructor.name;
    const eventHandlers = this.handlers.get(eventType) || [];
    
    await Promise.all(
      eventHandlers.map(handler => handler(event))
    );
  }

  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => Promise<void>
  ): void {
    const typeName = eventType.name;
    const existingHandlers = this.handlers.get(typeName) || [];
    this.handlers.set(typeName, [...existingHandlers, handler as any]);
  }
}

// イベントハンドラー
class OrderEventHandler {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly notificationService: NotificationService
  ) {}

  async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    // 在庫減少処理
    await this.inventoryService.reserveItems(event.orderId);
    
    // 通知送信処理
    await this.notificationService.sendOrderConfirmation(
      event.customerId,
      event.orderId
    );
  }
}
```

### 4. アプリケーションサービス

#### コマンドとクエリの分離（CQRS）

```typescript
// コマンド側（書き込み）
interface PlaceOrderCommand {
  readonly customerId: string;
  readonly items: OrderItemDto[];
}

class OrderApplicationService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly eventBus: EventBus
  ) {}

  async placeOrder(command: PlaceOrderCommand): Promise<OrderId> {
    const customer = await this.customerRepository.findById(
      CustomerId.fromString(command.customerId)
    );
    
    if (!customer) {
      throw new ApplicationException("顧客が見つかりません");
    }

    const order = Order.create(OrderId.generate(), customer.customerId);
    
    for (const itemDto of command.items) {
      order.addItem(
        ProductId.fromString(itemDto.productId),
        itemDto.quantity,
        Money.create(itemDto.price, "JPY")
      );
    }

    order.confirm();
    await this.orderRepository.save(order);

    // ドメインイベントの発行
    const events = order.getDomainEvents();
    for (const event of events) {
      await this.eventBus.publish(event);
    }
    order.clearDomainEvents();

    return order.id;
  }
}

// クエリ側（読み込み）
class OrderQueryService {
  constructor(private readonly queryDb: QueryDatabase) {}

  async getOrderSummary(orderId: string): Promise<OrderSummaryDto> {
    // 読み込み専用の最適化されたクエリ
    return this.queryDb.getOrderSummary(orderId);
  }

  async getCustomerOrders(customerId: string): Promise<OrderListDto[]> {
    return this.queryDb.getCustomerOrders(customerId);
  }
}
```

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
// Phase 1: 基本機能実装
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

// Phase 2: パフォーマンス最適化
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
```

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
  get id(): WishId { return this._id; }
  get content(): WishContent { return this._content; }
  get authorId(): UserId | SessionId { return this._authorId; }
  get supportCount(): SupportCount { return this._supportCount; }
  get supporters(): ReadonlySet<string> { return this._supporters; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
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

  get isValid(): boolean { return this._isValid; }
  get errorCode(): string | undefined { return this._errorCode; }
  get errorMessage(): string | undefined { return this._errorMessage; }
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

-- 願いテーブル
CREATE TABLE wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 240),
    author_id VARCHAR(255) NOT NULL,
    author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('user', 'session')),
    support_count INTEGER DEFAULT 0 CHECK (support_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 応援テーブル
CREATE TABLE wish_supports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wish_id UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
    supporter_id VARCHAR(255) NOT NULL,
    supporter_type VARCHAR(10) NOT NULL CHECK (supporter_type IN ('user', 'session')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wish_id, supporter_id, supporter_type)
);

-- パフォーマンス最適化のためのインデックス
CREATE INDEX idx_wishes_created_at ON wishes(created_at DESC);
CREATE INDEX idx_wishes_author ON wishes(author_id, author_type);
CREATE INDEX idx_wish_supports_wish_id ON wish_supports(wish_id);
CREATE INDEX idx_wish_supports_supporter ON wish_supports(supporter_id, supporter_type);

-- 応援数の整合性を保つトリガー
CREATE OR REPLACE FUNCTION update_support_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE wishes SET support_count = support_count + 1 WHERE id = NEW.wish_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE wishes SET support_count = support_count - 1 WHERE id = OLD.wish_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_count
    AFTER INSERT OR DELETE ON wish_supports
    FOR EACH ROW EXECUTE FUNCTION update_support_count();
```

### 2. API 設計とフロントエンド連携

#### RESTful API 設計

```typescript
import express from "express";
import { body, param, validationResult } from "express-validator";

export class WishController {
  constructor(
    private readonly wishService: WishService,
    private readonly authService: AuthService
  ) {}

  // 願い一覧取得
  async getWishes(req: express.Request, res: express.Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const viewer = SessionManager.getCachedViewer(req);
      const wishes = await this.wishService.getLatestWishes(limit, offset, viewer);

      res.json({
        success: true,
        data: wishes.map(wish => wish.toClientDTO()),
        pagination: {
          page,
          limit,
          hasMore: wishes.length === limit
        }
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // 願い作成
  async createWish(req: express.Request, res: express.Response): Promise<void> {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        errors: errors.array(),
      });
      return;
    }

    try {
      const viewer = SessionManager.getCachedViewer(req);
      const { content } = req.body;

      const wish = await this.wishService.createWish(
        WishContent.create(content),
        viewer
      );

      res.status(201).json({
        success: true,
        data: wish.toClientDTO(),
      });
    } catch (error) {
      this.handleError(error, res);
    }
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
export const createWishRoutes = (
  controller: WishController
): express.Router => {
  const router = express.Router();

  router.get("/wishes", controller.getWishes.bind(controller));

  router.post(
    "/wishes",
    [
      body("content")
        .isLength({ min: 1, max: 240 })
        .withMessage("Content must be between 1 and 240 characters"),
    ],
    controller.createWish.bind(controller)
  );

  return router;
};
```

#### 共有型定義

```typescript
// shared/types/wish.ts - フロントエンドと共有
export interface WishClientDTO {
  id: string;
  content: string;
  supportCount: number;
  isSupportedByViewer: boolean;
  isAuthoredByViewer: boolean;
  canSupport: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWishRequest {
  content: string;
}

export interface WishResponse {
  success: boolean;
  data?: WishClientDTO;
  error?: string;
  details?: any;
}

export interface WishListResponse {
  success: boolean;
  data?: WishClientDTO[];
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
  error?: string;
}
```

## テスト戦略

### 1. テストピラミッド

```
    E2E Tests (少数)
        ↓
Integration Tests (中程度)
        ↓
Unit Tests (多数)
```

### 2. ドメインレイヤーのユニットテスト

```typescript
// tests/unit/domain/entities/Wish.test.ts
describe('Wish Entity', () => {
  let wish: Wish;
  let author: SessionId;
  let supporter: SessionId;

  beforeEach(() => {
    author = SessionId.create('author-session');
    supporter = SessionId.create('supporter-session');
    wish = new Wish(
      WishId.generate(),
      WishContent.create('Test wish'),
      author
    );
  });

  describe('addSupport', () => {
    it('should successfully add support from different user', () => {
      // Act
      wish.addSupport(supporter);

      // Assert
      expect(wish.supportCount.value).toBe(1);
      expect(wish.isSupportedBy(supporter)).toBe(true);

      const events = wish.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(WishSupportedEvent);
    });

    it('should throw error when author tries to support own wish', () => {
      // Act & Assert
      expect(() => wish.addSupport(author)).toThrow(
        new DomainException(
          "作者は自分の願いに応援できません",
          "SELF_SUPPORT_NOT_ALLOWED"
        )
      );
    });

    it('should throw error when user tries to support twice', () => {
      // Arrange
      wish.addSupport(supporter);

      // Act & Assert
      expect(() => wish.addSupport(supporter)).toThrow(
        new DomainException("既に応援済みです", "ALREADY_SUPPORTED")
      );
    });
  });

  describe('canSupport', () => {
    it('should return success for valid supporter', () => {
      // Act
      const validation = wish.canSupport(supporter);

      // Assert
      expect(validation.isValid).toBe(true);
    });

    it('should return failure for author', () => {
      // Act
      const validation = wish.canSupport(author);

      // Assert
      expect(validation.isValid).toBe(false);
      expect(validation.errorCode).toBe("SELF_SUPPORT_NOT_ALLOWED");
    });
  });
});
```

### 3. リポジトリの統合テスト

```typescript
// tests/integration/repositories/PostgreSQLWishRepository.test.ts
describe('PostgreSQLWishRepository', () => {
  let repository: PostgreSQLWishRepository;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    repository = new PostgreSQLWishRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE wishes, wish_supports CASCADE');
  });

  describe('findLatestWithSupportStatus', () => {
    it('should return wishes with correct support status', async () => {
      // Arrange
      const author = SessionId.create('author');
      const supporter = SessionId.create('supporter');
      
      const wish = new Wish(
        WishId.generate(),
        WishContent.create('Test wish'),
        author
      );
      wish.addSupport(supporter);
      
      await repository.save(wish);

      // Act
      const result = await repository.findLatestWithSupportStatus(
        10, 0, supporter
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].wish.id.value).toBe(wish.id.value);
      expect(result[0].isSupportedByViewer).toBe(true);
      expect(result[0].isAuthoredByViewer).toBe(false);
    });
  });
});
```

---

**関連ドキュメント**:
- [基本原則](./architecture-core.md)
- [品質管理とメトリクス](./architecture-quality.md)
- [トラブルシューティング](./architecture-troubleshooting.md)

**最終更新日**: 2025 年 7 月 17 日  
**バージョン**: 2.0  
**対象プロジェクト**: TypeScript/Node.js + PostgreSQL 環境