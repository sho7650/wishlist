import { MockEventPublisher } from "../../../../src/adapters/secondary/MockEventPublisher";
import { DomainEvent } from "../../../../src/domain/events/DomainEvent";
import { Logger } from "../../../../src/utils/Logger";

// Mock the Logger
jest.mock("../../../../src/utils/Logger");

describe("MockEventPublisher", () => {
  let mockEventPublisher: MockEventPublisher;
  let mockLogger: jest.Mocked<typeof Logger>;

  beforeEach(() => {
    mockEventPublisher = new MockEventPublisher();
    mockLogger = Logger as jest.Mocked<typeof Logger>;
    jest.clearAllMocks();
  });

  describe("publish", () => {
    it("should log event publishing details", async () => {
      const mockEvent: DomainEvent = {
        eventName: "TestEvent",
        occurredOn: new Date(),
        constructor: { name: "TestEvent" }
      } as any;

      await mockEventPublisher.publish(mockEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[EVENT] Publishing event: TestEvent",
        {
          eventType: "TestEvent",
          occurredOn: mockEvent.occurredOn
        }
      );
    });

    it("should handle events with different names", async () => {
      const wishCreatedEvent: DomainEvent = {
        eventName: "WishCreated",
        occurredOn: new Date(),
        constructor: { name: "WishCreatedEvent" }
      } as any;

      await mockEventPublisher.publish(wishCreatedEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[EVENT] Publishing event: WishCreated",
        {
          eventType: "WishCreatedEvent",
          occurredOn: wishCreatedEvent.occurredOn
        }
      );
    });

    it("should complete without throwing errors", async () => {
      const mockEvent: DomainEvent = {
        eventName: "TestEvent",
        occurredOn: new Date(),
        constructor: { name: "TestEvent" }
      } as any;

      await expect(mockEventPublisher.publish(mockEvent)).resolves.toBeUndefined();
    });
  });

  describe("publishMany", () => {
    it("should log the number of events being published", async () => {
      const events: DomainEvent[] = [
        {
          eventName: "Event1",
          occurredOn: new Date(),
          constructor: { name: "Event1Type" }
        } as any,
        {
          eventName: "Event2",
          occurredOn: new Date(),
          constructor: { name: "Event2Type" }
        } as any,
        {
          eventName: "Event3",
          occurredOn: new Date(),
          constructor: { name: "Event3Type" }
        } as any
      ];

      await mockEventPublisher.publishMany(events);

      expect(mockLogger.debug).toHaveBeenCalledWith("[EVENT] Publishing 3 events");
    });

    it("should call publish for each event", async () => {
      const events: DomainEvent[] = [
        {
          eventName: "Event1",
          occurredOn: new Date(),
          constructor: { name: "Event1Type" }
        } as any,
        {
          eventName: "Event2",
          occurredOn: new Date(),
          constructor: { name: "Event2Type" }
        } as any
      ];

      // Spy on the publish method
      const publishSpy = jest.spyOn(mockEventPublisher, 'publish');

      await mockEventPublisher.publishMany(events);

      expect(publishSpy).toHaveBeenCalledTimes(2);
      expect(publishSpy).toHaveBeenNthCalledWith(1, events[0]);
      expect(publishSpy).toHaveBeenNthCalledWith(2, events[1]);
    });

    it("should handle empty event array", async () => {
      const events: DomainEvent[] = [];

      await mockEventPublisher.publishMany(events);

      expect(mockLogger.debug).toHaveBeenCalledWith("[EVENT] Publishing 0 events");
    });

    it("should handle single event", async () => {
      const events: DomainEvent[] = [
        {
          eventName: "SingleEvent",
          occurredOn: new Date(),
          constructor: { name: "SingleEventType" }
        } as any
      ];

      const publishSpy = jest.spyOn(mockEventPublisher, 'publish');

      await mockEventPublisher.publishMany(events);

      expect(mockLogger.debug).toHaveBeenCalledWith("[EVENT] Publishing 1 events");
      expect(publishSpy).toHaveBeenCalledTimes(1);
      expect(publishSpy).toHaveBeenCalledWith(events[0]);
    });

    it("should maintain order when publishing multiple events", async () => {
      const events: DomainEvent[] = [
        {
          eventName: "FirstEvent",
          occurredOn: new Date(),
          constructor: { name: "FirstEventType" }
        } as any,
        {
          eventName: "SecondEvent",
          occurredOn: new Date(),
          constructor: { name: "SecondEventType" }
        } as any,
        {
          eventName: "ThirdEvent",
          occurredOn: new Date(),
          constructor: { name: "ThirdEventType" }
        } as any
      ];

      const publishSpy = jest.spyOn(mockEventPublisher, 'publish');

      await mockEventPublisher.publishMany(events);

      // Verify events were published in order
      expect(publishSpy).toHaveBeenNthCalledWith(1, events[0]);
      expect(publishSpy).toHaveBeenNthCalledWith(2, events[1]);
      expect(publishSpy).toHaveBeenNthCalledWith(3, events[2]);
    });

    it("should complete without throwing errors", async () => {
      const events: DomainEvent[] = [
        {
          eventName: "Event1",
          occurredOn: new Date(),
          constructor: { name: "Event1Type" }
        } as any
      ];

      await expect(mockEventPublisher.publishMany(events)).resolves.toBeUndefined();
    });
  });
});