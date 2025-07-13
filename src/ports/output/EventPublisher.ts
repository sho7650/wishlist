import { DomainEvent } from "../../domain/events/DomainEvent";

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
}