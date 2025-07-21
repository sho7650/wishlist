import { EventPublisher } from "../../../ports/output/EventPublisher";
import { DomainEvent } from "../../../domain/events/DomainEvent";
import { Logger } from "../../../utils/Logger";
import { 
  EventDispatcher, 
  EventDispatchResult
} from "../../../domain/events/observers/EventDispatcher";
import { ObserverExecutionConfig } from "../../../domain/events/observers/EventObserver";

/**
 * Enhanced EventBusAdapter with Observer Pattern integration
 * Maintains backward compatibility while adding observer functionality
 */
export class EventBusAdapter implements EventPublisher {
  private eventDispatcher: EventDispatcher;
  private isObserverModeEnabled: boolean;

  constructor(
    eventDispatcher?: EventDispatcher,
    enableObserverMode: boolean = true
  ) {
    this.eventDispatcher = eventDispatcher || new EventDispatcher();
    this.isObserverModeEnabled = enableObserverMode;
  }

  /**
   * Publish a single event (backward compatible)
   * Now also dispatches to observers if observer mode is enabled
   */
  async publish(event: DomainEvent): Promise<void> {
    Logger.debug(`Publishing event: ${event.eventName}`, {
      eventName: event.eventName,
      occurredOn: event.occurredOn,
      observerMode: this.isObserverModeEnabled
    });

    // If observer mode is enabled, dispatch to observers
    if (this.isObserverModeEnabled) {
      try {
        const result = await this.eventDispatcher.dispatch(event);
        
        Logger.info(`Event ${event.eventName} dispatched to observers`, {
          eventName: event.eventName,
          totalObservers: result.totalObservers,
          successfulObservers: result.successfulObservers,
          failedObservers: result.failedObservers,
          executionTime: result.totalExecutionTime
        });

        // Log any errors from observers
        if (result.errors.length > 0) {
          Logger.warn(`Some observers failed for event ${event.eventName}`, {
            eventName: event.eventName,
            errorCount: result.errors.length,
            errors: result.errors.map(e => e.message)
          });
        }
      } catch (error) {
        Logger.error(`Failed to dispatch event ${event.eventName} to observers`, error as Error);
        // Don't throw - we want event publishing to be resilient
      }
    }
  }

  /**
   * Publish multiple events (backward compatible)
   */
  async publishMany(events: DomainEvent[]): Promise<void> {
    Logger.debug(`Publishing ${events.length} events`, {
      eventCount: events.length,
      eventNames: events.map(e => e.eventName),
      observerMode: this.isObserverModeEnabled
    });

    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Advanced publishing with custom observer execution configuration
   */
  async publishWithConfig(
    event: DomainEvent, 
    config: Partial<ObserverExecutionConfig>
  ): Promise<EventDispatchResult | null> {
    Logger.debug(`Publishing event with custom config: ${event.eventName}`, {
      eventName: event.eventName,
      config
    });

    if (!this.isObserverModeEnabled) {
      Logger.warn('Observer mode disabled, custom config ignored');
      await this.publish(event);
      return null;
    }

    try {
      const result = await this.eventDispatcher.dispatch(event, config);
      
      Logger.info(`Event ${event.eventName} dispatched with custom config`, {
        eventName: event.eventName,
        strategy: config.strategy,
        totalObservers: result.totalObservers,
        successfulObservers: result.successfulObservers,
        failedObservers: result.failedObservers,
        executionTime: result.totalExecutionTime
      });

      return result;
    } catch (error) {
      Logger.error(`Failed to dispatch event ${event.eventName} with custom config`, error as Error);
      throw error;
    }
  }

  /**
   * Get the event dispatcher for observer management
   */
  getEventDispatcher(): EventDispatcher {
    return this.eventDispatcher;
  }

  /**
   * Enable or disable observer mode
   */
  setObserverMode(enabled: boolean): void {
    this.isObserverModeEnabled = enabled;
    Logger.info(`Observer mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if observer mode is enabled
   */
  getObserverModeEnabled(): boolean {
    return this.isObserverModeEnabled;
  }

  /**
   * Get statistics about observer execution
   */
  async getObserverStats(): Promise<{
    totalObservers: number;
    observersByEventType: Record<string, number>;
    registeredObservers: string[];
  }> {
    const allObservers = this.eventDispatcher.getAllObservers();
    const observersByEventType: Record<string, number> = {};

    // Count observers by event type
    for (const observer of allObservers) {
      for (const eventType of observer.eventTypes) {
        observersByEventType[eventType] = (observersByEventType[eventType] || 0) + 1;
      }
    }

    return {
      totalObservers: allObservers.length,
      observersByEventType,
      registeredObservers: allObservers.map(o => o.observerName)
    };
  }

  /**
   * Initialize default observers (called during application startup)
   */
  async initializeDefaultObservers(): Promise<void> {
    if (!this.isObserverModeEnabled) {
      Logger.info('Observer mode disabled, skipping default observer initialization');
      return;
    }

    Logger.info('Initializing default observers...');

    try {
      // Import simplified observer classes
      const { 
        SimpleNotificationObserver 
      } = require('../../../domain/events/observers/concrete/SimpleNotificationObserver');
      const { 
        SimpleAnalyticsObserver 
      } = require('../../../domain/events/observers/concrete/SimpleAnalyticsObserver');

      // Register default observers
      const notificationObserver = new SimpleNotificationObserver();
      const analyticsObserver = new SimpleAnalyticsObserver();

      await this.eventDispatcher.register(notificationObserver);
      await this.eventDispatcher.register(analyticsObserver);

      Logger.info('Default observers initialized successfully', {
        observers: [
          notificationObserver.observerName,
          analyticsObserver.observerName
        ]
      });
    } catch (error) {
      Logger.error('Failed to initialize default observers', error as Error);
      throw error;
    }
  }

  /**
   * Cleanup all observers (called during application shutdown)
   */
  async cleanup(): Promise<void> {
    Logger.info('Cleaning up event bus and observers...');
    
    try {
      await this.eventDispatcher.clear();
      Logger.info('Event bus cleanup completed');
    } catch (error) {
      Logger.error('Error during event bus cleanup', error as Error);
      throw error;
    }
  }
}