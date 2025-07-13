import { DomainEvent } from './DomainEvent';
import { WishId } from '../value-objects/WishId';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';

export class WishCreatedEvent extends DomainEvent {
  constructor(
    public readonly wishId: WishId,
    public readonly authorId: UserId | SessionId,
    public readonly createdAt: Date = new Date()
  ) {
    super();
  }

  get eventName(): string {
    return 'WishCreated';
  }
}