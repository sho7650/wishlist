import { EventPublisher } from "../../../ports/output/EventPublisher";
import { DomainEvent } from "../../../domain/events/DomainEvent";
import { Logger } from "../../../utils/Logger";

export class EventBusAdapter implements EventPublisher {
  async publish(event: DomainEvent): Promise<void> {
    Logger.debug(`Publishing event: ${event.eventName}`, {
      eventName: event.eventName,
      occurredOn: event.occurredOn
    });
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}