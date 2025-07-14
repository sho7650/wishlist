import { WishId } from '../value-objects/WishId';
import { WishContent } from '../value-objects/WishContent';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { SupportCount } from '../value-objects/SupportCount';
import { DomainEvent } from '../events/DomainEvent';
import { WishCreatedEvent } from '../events/WishCreatedEvent';
import { WishSupportedEvent } from '../events/WishSupportedEvent';
import { WishSupportRemovedEvent } from '../events/WishSupportRemovedEvent';
import { DomainException } from '../exceptions/DomainException';

export interface WishProps {
  id?: WishId;
  authorId: UserId | SessionId;
  name?: string;
  content: WishContent;
  supportCount?: SupportCount;
  supporters?: Set<string>;
  createdAt?: Date;
  updatedAt?: Date;
  isSupported?: boolean;
}

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

export class Wish {
  public static readonly MAX_NAME_LENGTH = 64;
  private _domainEvents: DomainEvent[] = [];

  private constructor(
    private readonly _id: WishId,
    private readonly _content: WishContent,
    private readonly _authorId: UserId | SessionId,
    private _supportCount: SupportCount = SupportCount.zero(),
    private readonly _supporters: Set<string> = new Set(),
    private readonly _name?: string,
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date(),
    private readonly _isSupported?: boolean
  ) {
    if (_name && _name.length > Wish.MAX_NAME_LENGTH) {
      throw new DomainException(
        `Name cannot be longer than ${Wish.MAX_NAME_LENGTH} characters`,
        'INVALID_NAME_LENGTH'
      );
    }
  }

  static create(props: WishProps): Wish {
    const id = props.id || WishId.generate();
    const wish = new Wish(
      id,
      props.content,
      props.authorId,
      props.supportCount,
      props.supporters,
      props.name,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
      props.isSupported
    );
    
    wish.addDomainEvent(new WishCreatedEvent(wish.wishId, props.authorId));
    return wish;
  }

  static fromRepository(props: WishProps): Wish {
    return new Wish(
      props.id || WishId.generate(),
      props.content,
      props.authorId,
      props.supportCount,
      props.supporters,
      props.name,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
      props.isSupported
    );
  }

  public addSupport(supporter: UserId | SessionId): void {
    if (this.isAuthor(supporter)) {
      throw new DomainException(
        "作者は自分の願いに応援できません",
        "SELF_SUPPORT_NOT_ALLOWED"
      );
    }

    if (this.isSupportedBy(supporter)) {
      throw new DomainException("既に応援済みです", "ALREADY_SUPPORTED");
    }

    // Use consistent identifier format
    const supporterId = supporter.type === 'user' 
      ? `user_${supporter.value}` 
      : `session_${supporter.value}`;
    
    this._supporters.add(supporterId);
    this._supportCount = this._supportCount.increment();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new WishSupportedEvent(
        this.wishId,
        supporter,
        this.supportCountVO,
        new Date()
      )
    );
  }

  public removeSupport(supporter: UserId | SessionId): void {
    if (!this.isSupportedBy(supporter)) {
      throw new DomainException("応援していません", "NOT_SUPPORTED");
    }

    // Use consistent identifier format
    const supporterId = supporter.type === 'user' 
      ? `user_${supporter.value}` 
      : `session_${supporter.value}`;
    
    this._supporters.delete(supporterId);
    this._supportCount = this._supportCount.decrement();
    this._updatedAt = new Date();

    this.addDomainEvent(
      new WishSupportRemovedEvent(
        this.wishId,
        supporter,
        this.supportCountVO,
        new Date()
      )
    );
  }

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
      this._authorId.value.toString() === supporter.value.toString() &&
      this._authorId.type === supporter.type
    );
  }

  private isSupportedBy(supporter: UserId | SessionId): boolean {
    const supporterId = supporter.type === 'user' 
      ? `user_${supporter.value}` 
      : `session_${supporter.value}`;
    return this._supporters.has(supporterId);
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

  public update(name?: string, wish?: string): Wish {
    const newContent = wish !== undefined ? WishContent.fromString(wish) : this._content;
    const newName = name !== undefined ? name : this._name;
    
    return new Wish(
      this._id,
      newContent,
      this._authorId,
      this._supportCount,
      this._supporters,
      newName,
      this._createdAt,
      new Date(),
      this._isSupported
    );
  }

  // Removed WishId getter in favor of legacy compatibility
  
  get content(): WishContent {
    return this._content;
  }
  
  get authorId(): UserId | SessionId {
    return this._authorId;
  }
  
  get supportCount(): number {
    return this._supportCount.value; // Return number for legacy compatibility
  }
  
  get supporters(): ReadonlySet<string> {
    return this._supporters;
  }
  
  get name(): string | undefined {
    return this._name;
  }
  
  get createdAt(): Date {
    return this._createdAt;
  }
  
  get updatedAt(): Date {
    return this._updatedAt;
  }
  
  get isSupported(): boolean | undefined {
    return this._isSupported;
  }

  // Legacy compatibility methods
  get wish(): string {
    return this._content.value;
  }
  
  get userId(): number | undefined {
    return this._authorId.type === 'user' ? (this._authorId as UserId).value : undefined;
  }

  // Override the id getter for legacy compatibility
  get id(): any {
    return this._id.value; // Return string value instead of WishId object
  }

  // Internal methods for domain logic that use Value Objects
  get wishId(): WishId {
    return this._id;
  }

  get supportCountVO(): SupportCount {
    return this._supportCount;
  }

  // JSON serialization for API responses
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      wish: this.wish,
      userId: this.userId,
      supportCount: this.supportCount,
      isSupported: this.isSupported,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
