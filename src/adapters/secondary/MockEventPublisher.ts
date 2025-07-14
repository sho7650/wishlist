import { EventPublisher } from "../../ports/output/EventPublisher";
import { DomainEvent } from "../../domain/events/DomainEvent";
import { Logger } from "../../utils/Logger";

export class MockEventPublisher implements EventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    Logger.debug(`[EVENT] Publishing event: ${event.eventName}`, {
      eventType: event.constructor.name,
      occurredOn: event.occurredOn
    });
    // Mock implementation - in production this would publish to a message queue
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    Logger.debug(`[EVENT] Publishing ${events.length} events`);
    for (const event of events) {
      await this.publish(event);
    }
  }
}