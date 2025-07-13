import { DomainEvent } from './DomainEvent';
import { WishId } from '../value-objects/WishId';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { SupportCount } from '../value-objects/SupportCount';

export class WishSupportRemovedEvent extends DomainEvent {
  constructor(
    public readonly wishId: WishId,
    public readonly supporter: UserId | SessionId,
    public readonly newSupportCount: SupportCount,
    public readonly removedAt: Date = new Date()
  ) {
    super();
  }

  get eventName(): string {
    return 'WishSupportRemoved';
  }
}