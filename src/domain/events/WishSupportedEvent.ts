import { DomainEvent } from './DomainEvent';
import { WishId } from '../value-objects/WishId';
import { UserId } from '../value-objects/UserId';
import { SessionId } from '../value-objects/SessionId';
import { SupportCount } from '../value-objects/SupportCount';

export class WishSupportedEvent extends DomainEvent {
  constructor(
    public readonly wishId: WishId,
    public readonly supporter: UserId | SessionId,
    public readonly newSupportCount: SupportCount,
    public readonly supportedAt: Date = new Date()
  ) {
    super();
  }

  get eventName(): string {
    return 'WishSupported';
  }
}