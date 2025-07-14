import { DomainEvent } from "./DomainEvent";
import { User } from "../auth/User";

/**
 * Domain event fired when a new user registers
 */
export class UserRegisteredEvent extends DomainEvent {
  public readonly eventType = "UserRegistered" as const;

  constructor(
    public readonly user: User,
    public readonly registeredAt: Date = new Date()
  ) {
    super();
  }

  get eventName(): string {
    return this.eventType;
  }
}