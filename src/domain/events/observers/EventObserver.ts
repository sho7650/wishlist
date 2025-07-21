/**
 * Observer Pattern Implementation for Domain Events
 * Provides type-safe event handling and subscription mechanism
 */

import { DomainEvent } from "../DomainEvent";
import { Result } from "../../shared/Result";
import { ApplicationError, ObserverExecutionError } from "../../shared/ApplicationError";

/**
 * Observer execution context with metadata
 */
export interface ObserverContext {
  eventId: string;
  eventName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Observer execution result
 */
export interface ObserverResult {
  success: boolean;
  error?: ApplicationError;
  executionTime?: number;
  metadata?: Record<string, any>;
}

/**
 * Generic event observer interface
 */
export interface EventObserver<T extends DomainEvent = DomainEvent> {
  /**
   * Unique identifier for the observer
   */
  readonly observerId: string;

  /**
   * Name of the observer for debugging and logging
   */
  readonly observerName: string;

  /**
   * Event types this observer is interested in
   */
  readonly eventTypes: readonly string[];

  /**
   * Priority for execution order (higher priority = executes first)
   */
  readonly priority: number;

  /**
   * Whether this observer should execute asynchronously
   */
  readonly async: boolean;

  /**
   * Handle the event and return result
   */
  handle(event: T, context: ObserverContext): Promise<ObserverResult>;

  /**
   * Check if this observer can handle the given event
   */
  canHandle(event: DomainEvent): boolean;

  /**
   * Initialize the observer (called when registered)
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup the observer (called when unregistered)
   */
  cleanup?(): Promise<void>;
}

/**
 * Abstract base class for event observers with common functionality
 */
export abstract class BaseEventObserver<T extends DomainEvent = DomainEvent> implements EventObserver<T> {
  protected constructor(
    public readonly observerId: string,
    public readonly observerName: string,
    public readonly eventTypes: readonly string[],
    public readonly priority: number = 0,
    public readonly async: boolean = true
  ) {}

  /**
   * Abstract method to be implemented by concrete observers
   */
  protected abstract handleEvent(event: T, context: ObserverContext): Promise<ObserverResult>;

  /**
   * Template method that handles logging and error handling
   */
  async handle(event: T, context: ObserverContext): Promise<ObserverResult> {
    const startTime = Date.now();
    
    try {
      // Log event handling start
      this.logEventHandling(event, context, 'start');
      
      // Execute the concrete handler
      const result = await this.handleEvent(event, context);
      
      // Add execution time
      result.executionTime = Date.now() - startTime;
      
      // Log result
      this.logEventHandling(event, context, result.success ? 'success' : 'error', result);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorResult: ObserverResult = {
        success: false,
        error: error instanceof ApplicationError ? error : new ObserverExecutionError(
          `Observer ${this.observerName} failed to handle event ${event.eventName}`,
          this.observerId,
          event.eventName,
          { observerName: this.observerName },
          error instanceof Error ? error : new Error(String(error))
        ),
        executionTime
      };
      
      this.logEventHandling(event, context, 'error', errorResult);
      return errorResult;
    }
  }

  /**
   * Default implementation checks if event type is in eventTypes array
   */
  canHandle(event: DomainEvent): boolean {
    return this.eventTypes.includes(event.eventName);
  }

  /**
   * Helper method for creating successful results
   */
  protected success(metadata?: Record<string, any>): ObserverResult {
    return {
      success: true,
      metadata
    };
  }

  /**
   * Helper method for creating error results
   */
  protected failure(error: ApplicationError, metadata?: Record<string, any>): ObserverResult {
    return {
      success: false,
      error,
      metadata
    };
  }

  /**
   * Log event handling with different levels
   */
  private logEventHandling(
    event: DomainEvent, 
    context: ObserverContext, 
    phase: 'start' | 'success' | 'error',
    result?: ObserverResult
  ): void {
    const Logger = require('../../../utils/Logger').Logger;
    
    const logData = {
      observerId: this.observerId,
      observerName: this.observerName,
      eventName: event.eventName,
      eventId: context.eventId,
      phase,
      executionTime: result?.executionTime
    };

    switch (phase) {
      case 'start':
        Logger.debug(`[OBSERVER] ${this.observerName} handling ${event.eventName}`, logData);
        break;
      case 'success':
        Logger.info(`[OBSERVER] ${this.observerName} successfully handled ${event.eventName}`, logData);
        break;
      case 'error':
        Logger.error(`[OBSERVER] ${this.observerName} failed to handle ${event.eventName}`, result?.error, logData);
        break;
    }
  }

  /**
   * Default initialization (override if needed)
   */
  async initialize(): Promise<void> {
    const Logger = require('../../../utils/Logger').Logger;
    Logger.debug(`[OBSERVER] Initializing observer ${this.observerName}`);
  }

  /**
   * Default cleanup (override if needed)
   */
  async cleanup(): Promise<void> {
    const Logger = require('../../../utils/Logger').Logger;
    Logger.debug(`[OBSERVER] Cleaning up observer ${this.observerName}`);
  }
}


/**
 * Observer subscription management
 */
export interface ObserverSubscription {
  readonly subscriptionId: string;
  readonly observer: EventObserver;
  readonly eventTypes: readonly string[];
  readonly subscribedAt: Date;
  
  /**
   * Unsubscribe this observer from events
   */
  unsubscribe(): Promise<void>;
}

/**
 * Observer execution strategy
 */
export type ObserverExecutionStrategy = 'sequential' | 'parallel' | 'fire-and-forget';

/**
 * Observer execution configuration
 */
export interface ObserverExecutionConfig {
  strategy: ObserverExecutionStrategy;
  maxConcurrency?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  failFast?: boolean;
}

/**
 * Observer registry for managing observer subscriptions
 */
export interface ObserverRegistry {
  /**
   * Register an observer for specific event types
   */
  register<T extends DomainEvent>(
    observer: EventObserver<T>,
    eventTypes?: string[]
  ): Promise<ObserverSubscription>;

  /**
   * Unregister an observer
   */
  unregister(observerId: string): Promise<boolean>;

  /**
   * Get all observers for a specific event type
   */
  getObserversForEvent(eventType: string): EventObserver[];

  /**
   * Get all registered observers
   */
  getAllObservers(): EventObserver[];

  /**
   * Check if an observer is registered
   */
  isRegistered(observerId: string): boolean;

  /**
   * Clear all observers
   */
  clear(): Promise<void>;
}