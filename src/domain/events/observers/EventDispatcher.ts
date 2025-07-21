/**
 * Event Dispatcher Implementation
 * Manages observer subscriptions and coordinates event distribution
 */

import { DomainEvent } from "../DomainEvent";
import { 
  EventObserver, 
  ObserverRegistry, 
  ObserverSubscription, 
  ObserverContext, 
  ObserverResult,
  ObserverExecutionConfig,
  ObserverExecutionStrategy
} from "./EventObserver";
import { Result } from "../../shared/Result";
import { ApplicationError, ObserverExecutionError, ObserverRegistrationError } from "../../shared/ApplicationError";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../../../utils/Logger";

/**
 * Event dispatch result containing results from all observers
 */
export interface EventDispatchResult {
  eventId: string;
  eventName: string;
  totalObservers: number;
  successfulObservers: number;
  failedObservers: number;
  results: ObserverResult[];
  totalExecutionTime: number;
  errors: ApplicationError[];
}

/**
 * Observer subscription implementation
 */
class ObserverSubscriptionImpl implements ObserverSubscription {
  constructor(
    public readonly subscriptionId: string,
    public readonly observer: EventObserver,
    public readonly eventTypes: readonly string[],
    public readonly subscribedAt: Date,
    private readonly registry: EventDispatcher
  ) {}

  async unsubscribe(): Promise<void> {
    await this.registry.unregister(this.observer.observerId);
  }
}

/**
 * Event dispatcher that implements the Observer pattern
 */
export class EventDispatcher implements ObserverRegistry {
  private readonly observers = new Map<string, EventObserver>();
  private readonly subscriptions = new Map<string, ObserverSubscription>();
  private readonly eventTypeObservers = new Map<string, Set<string>>();
  
  private readonly defaultConfig: ObserverExecutionConfig = {
    strategy: 'parallel',
    maxConcurrency: 10,
    timeout: 30000, // 30 seconds
    retryAttempts: 2,
    retryDelay: 1000, // 1 second
    failFast: false
  };

  /**
   * Register an observer for specific event types
   */
  async register<T extends DomainEvent>(
    observer: EventObserver<T>,
    eventTypes?: string[]
  ): Promise<ObserverSubscription> {
    Logger.debug(`[EVENT_DISPATCHER] Registering observer ${observer.observerName}`, {
      observerId: observer.observerId,
      eventTypes: eventTypes || observer.eventTypes
    });

    // Check if observer is already registered
    if (this.observers.has(observer.observerId)) {
      throw new ObserverRegistrationError(
        `Observer with ID ${observer.observerId} is already registered`,
        observer.observerId
      );
    }

    // Use provided event types or observer's default event types
    const typesToRegister = eventTypes || observer.eventTypes;

    // Initialize observer if it has initialization logic
    if (observer.initialize) {
      await observer.initialize();
    }

    // Register observer
    this.observers.set(observer.observerId, observer);

    // Update event type mappings
    for (const eventType of typesToRegister) {
      if (!this.eventTypeObservers.has(eventType)) {
        this.eventTypeObservers.set(eventType, new Set());
      }
      this.eventTypeObservers.get(eventType)!.add(observer.observerId);
    }

    // Create subscription
    const subscription = new ObserverSubscriptionImpl(
      uuidv4(),
      observer,
      typesToRegister,
      new Date(),
      this
    );

    this.subscriptions.set(observer.observerId, subscription);

    Logger.info(`[EVENT_DISPATCHER] Observer ${observer.observerName} registered successfully`, {
      observerId: observer.observerId,
      eventTypes: typesToRegister,
      totalObservers: this.observers.size
    });

    return subscription;
  }

  /**
   * Unregister an observer
   */
  async unregister(observerId: string): Promise<boolean> {
    Logger.debug(`[EVENT_DISPATCHER] Unregistering observer ${observerId}`);

    const observer = this.observers.get(observerId);
    if (!observer) {
      Logger.warn(`[EVENT_DISPATCHER] Observer ${observerId} not found for unregistration`);
      return false;
    }

    // Cleanup observer if it has cleanup logic
    if (observer.cleanup) {
      try {
        await observer.cleanup();
      } catch (error) {
        Logger.error(`[EVENT_DISPATCHER] Error during observer cleanup for observer ${observerId}`, error as Error);
      }
    }

    // Remove from event type mappings
    for (const [eventType, observerSet] of this.eventTypeObservers.entries()) {
      observerSet.delete(observerId);
      if (observerSet.size === 0) {
        this.eventTypeObservers.delete(eventType);
      }
    }

    // Remove from collections
    this.observers.delete(observerId);
    this.subscriptions.delete(observerId);

    Logger.info(`[EVENT_DISPATCHER] Observer ${observer.observerName} unregistered successfully`, {
      observerId,
      totalObservers: this.observers.size
    });

    return true;
  }

  /**
   * Get all observers for a specific event type
   */
  getObserversForEvent(eventType: string): EventObserver[] {
    const observerIds = this.eventTypeObservers.get(eventType) || new Set();
    const observers: EventObserver[] = [];

    for (const observerId of observerIds) {
      const observer = this.observers.get(observerId);
      if (observer) {
        observers.push(observer);
      }
    }

    // Sort by priority (higher priority first)
    return observers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all registered observers
   */
  getAllObservers(): EventObserver[] {
    return Array.from(this.observers.values());
  }

  /**
   * Check if an observer is registered
   */
  isRegistered(observerId: string): boolean {
    return this.observers.has(observerId);
  }

  /**
   * Clear all observers
   */
  async clear(): Promise<void> {
    Logger.debug('[EVENT_DISPATCHER] Clearing all observers');

    const observerIds = Array.from(this.observers.keys());
    
    // Unregister all observers (this will call cleanup on each)
    for (const observerId of observerIds) {
      await this.unregister(observerId);
    }

    Logger.info('[EVENT_DISPATCHER] All observers cleared');
  }

  /**
   * Dispatch an event to all interested observers
   */
  async dispatch(
    event: DomainEvent, 
    config: Partial<ObserverExecutionConfig> = {}
  ): Promise<EventDispatchResult> {
    const startTime = Date.now();
    const eventId = uuidv4();
    const executionConfig = { ...this.defaultConfig, ...config };

    Logger.debug(`[EVENT_DISPATCHER] Dispatching event ${event.eventName}`, {
      eventId,
      eventName: event.eventName,
      strategy: executionConfig.strategy
    });

    // Get observers for this event type
    const observers = this.getObserversForEvent(event.eventName)
      .filter(observer => observer.canHandle(event));

    if (observers.length === 0) {
      Logger.debug(`[EVENT_DISPATCHER] No observers found for event ${event.eventName}`, {
        eventId
      });
      
      return {
        eventId,
        eventName: event.eventName,
        totalObservers: 0,
        successfulObservers: 0,
        failedObservers: 0,
        results: [],
        totalExecutionTime: Date.now() - startTime,
        errors: []
      };
    }

    Logger.info(`[EVENT_DISPATCHER] Executing ${observers.length} observers for event ${event.eventName}`, {
      eventId,
      observerNames: observers.map(o => o.observerName),
      strategy: executionConfig.strategy
    });

    // Create observer context
    const context: ObserverContext = {
      eventId,
      eventName: event.eventName,
      timestamp: new Date(),
      metadata: { dispatchConfig: executionConfig }
    };

    // Execute observers based on strategy
    const results = await this.executeObservers(observers, event, context, executionConfig);

    // Compile dispatch result
    const successfulObservers = results.filter(r => r.success).length;
    const failedObservers = results.filter(r => !r.success).length;
    const errors = results.filter(r => r.error).map(r => r.error!);

    const dispatchResult: EventDispatchResult = {
      eventId,
      eventName: event.eventName,
      totalObservers: observers.length,
      successfulObservers,
      failedObservers,
      results,
      totalExecutionTime: Date.now() - startTime,
      errors
    };

    Logger.info(`[EVENT_DISPATCHER] Event ${event.eventName} dispatch completed`, {
      eventId,
      totalObservers: observers.length,
      successfulObservers,
      failedObservers,
      totalExecutionTime: dispatchResult.totalExecutionTime
    });

    return dispatchResult;
  }

  /**
   * Execute observers based on the specified strategy
   */
  private async executeObservers(
    observers: EventObserver[],
    event: DomainEvent,
    context: ObserverContext,
    config: ObserverExecutionConfig
  ): Promise<ObserverResult[]> {
    switch (config.strategy) {
      case 'sequential':
        return this.executeSequentially(observers, event, context, config);
      case 'parallel':
        return this.executeInParallel(observers, event, context, config);
      case 'fire-and-forget':
        return this.executeFireAndForget(observers, event, context, config);
      default:
        throw new Error(`Unknown execution strategy: ${config.strategy}`);
    }
  }

  /**
   * Execute observers sequentially
   */
  private async executeSequentially(
    observers: EventObserver[],
    event: DomainEvent,
    context: ObserverContext,
    config: ObserverExecutionConfig
  ): Promise<ObserverResult[]> {
    const results: ObserverResult[] = [];

    for (const observer of observers) {
      try {
        const result = await this.executeObserverWithRetry(observer, event, context, config);
        results.push(result);

        // Fail fast if configured and observer failed
        if (config.failFast && !result.success) {
          Logger.warn(`[EVENT_DISPATCHER] Fail-fast triggered by observer ${observer.observerName}`);
          break;
        }
      } catch (error) {
        const errorResult: ObserverResult = {
          success: false,
          error: error instanceof ApplicationError ? error : new ObserverExecutionError(
            `Observer ${observer.observerName} execution failed`,
            observer.observerId,
            context.eventName,
            { observerName: observer.observerName },
            error instanceof Error ? error : new Error(String(error))
          )
        };
        results.push(errorResult);

        if (config.failFast) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute observers in parallel with concurrency control
   */
  private async executeInParallel(
    observers: EventObserver[],
    event: DomainEvent,
    context: ObserverContext,
    config: ObserverExecutionConfig
  ): Promise<ObserverResult[]> {
    const maxConcurrency = config.maxConcurrency || 10;
    const results: ObserverResult[] = [];

    // Split observers into batches
    for (let i = 0; i < observers.length; i += maxConcurrency) {
      const batch = observers.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(observer =>
        this.executeObserverWithRetry(observer, event, context, config)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: new ObserverExecutionError(
              'Observer execution promise rejected',
              'unknown',
              context.eventName,
              { reason: result.reason },
              result.reason instanceof Error ? result.reason : new Error(String(result.reason))
            )
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute observers in fire-and-forget mode
   */
  private async executeFireAndForget(
    observers: EventObserver[],
    event: DomainEvent,
    context: ObserverContext,
    config: ObserverExecutionConfig
  ): Promise<ObserverResult[]> {
    // Start all observers without waiting for results
    const promises = observers.map(observer =>
      this.executeObserverWithRetry(observer, event, context, config)
        .catch(error => ({
          success: false,
          error: error instanceof ApplicationError ? error : new ObserverExecutionError(
            `Observer ${observer.observerName} execution failed`,
            observer.observerId,
            context.eventName,
            { observerName: observer.observerName },
            error instanceof Error ? error : new Error(String(error))
          )
        } as ObserverResult))
    );

    // Don't wait for completion in fire-and-forget mode
    // Return immediately with pending results
    return new Array(observers.length).fill({
      success: true,
      metadata: { mode: 'fire-and-forget', pending: true }
    });
  }

  /**
   * Execute a single observer with retry logic
   */
  private async executeObserverWithRetry(
    observer: EventObserver,
    event: DomainEvent,
    context: ObserverContext,
    config: ObserverExecutionConfig
  ): Promise<ObserverResult> {
    const maxAttempts = (config.retryAttempts || 0) + 1;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Add timeout if configured
        const executePromise = observer.handle(event, context);
        
        if (config.timeout) {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Observer execution timeout')), config.timeout)
          );
          
          return await Promise.race([executePromise, timeoutPromise]);
        } else {
          return await executePromise;
        }
      } catch (error) {
        lastError = error;
        
        if (attempt < maxAttempts) {
          Logger.warn(`[EVENT_DISPATCHER] Observer ${observer.observerName} failed, retrying (${attempt}/${maxAttempts})`, {
            error: error instanceof Error ? error.message : String(error)
          });
          
          if (config.retryDelay) {
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
          }
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError instanceof ApplicationError ? lastError : new ObserverExecutionError(
        `Observer ${observer.observerName} failed after ${maxAttempts} attempts`,
        observer.observerId,
        context.eventName,
        { observerName: observer.observerName, maxAttempts },
        lastError instanceof Error ? lastError : new Error(String(lastError))
      )
    };
  }
}

