/**
 * Simplified Analytics Observer Implementation
 * Tracks basic metrics from domain events with value object compatibility
 */

import { BaseEventObserver, ObserverContext, ObserverResult } from "../EventObserver";
import { DomainEvent } from "../../DomainEvent";
import { WishCreatedEvent } from "../../WishCreatedEvent";
import { WishSupportedEvent } from "../../WishSupportedEvent";
import { WishSupportRemovedEvent } from "../../WishSupportRemovedEvent";
import { UserRegisteredEvent } from "../../UserRegisteredEvent";
import { Logger } from "../../../../utils/Logger";
import { ApplicationError } from "../../../shared/ApplicationError";

/**
 * Simple analytics metric
 */
export interface SimpleMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: Date;
}

/**
 * Simple analytics service
 */
export interface SimpleAnalyticsService {
  track(metric: SimpleMetric): Promise<void>;
}

/**
 * Console-based simple analytics service
 */
export class ConsoleSimpleAnalyticsService implements SimpleAnalyticsService {
  async track(metric: SimpleMetric): Promise<void> {
    console.log(`📊 [ANALYTICS] ${metric.name}: ${metric.value}`, metric.tags);
  }
}

/**
 * Simplified analytics observer that works with value objects
 */
export class SimpleAnalyticsObserver extends BaseEventObserver {
  constructor(
    private analyticsService: SimpleAnalyticsService = new ConsoleSimpleAnalyticsService()
  ) {
    super(
      'simple-analytics-observer',
      'Simple Analytics Observer',
      ['WishCreated', 'WishSupported', 'WishSupportRemoved', 'UserRegistered'],
      5, // Medium priority
      true // Async execution
    );
  }

  protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
    Logger.debug(`[SIMPLE_ANALYTICS_OBSERVER] Processing ${event.eventName} event`, {
      eventId: context.eventId,
      eventName: event.eventName
    });

    try {
      const metrics = await this.createMetricsForEvent(event, context);
      
      for (const metric of metrics) {
        await this.analyticsService.track(metric);
      }

      Logger.debug(`[SIMPLE_ANALYTICS_OBSERVER] Tracked ${metrics.length} metrics for ${event.eventName}`, {
        eventId: context.eventId,
        metricCount: metrics.length
      });

      return this.success({
        metricCount: metrics.length,
        eventName: event.eventName
      });
    } catch (error) {
      Logger.error(`[SIMPLE_ANALYTICS_OBSERVER] Failed to track analytics for ${event.eventName}`, error as Error);
      return this.failure(
        new SimpleAnalyticsError(
          `Failed to track analytics for ${event.eventName}`,
          event.eventName,
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Create simple metrics based on the event type
   */
  private async createMetricsForEvent(event: DomainEvent, context: ObserverContext): Promise<SimpleMetric[]> {
    const timestamp = new Date();
    const baseTagsString = { eventId: context.eventId };

    switch (event.eventName) {
      case 'WishCreated':
        const wishEvent = event as WishCreatedEvent;
        return [{
          name: 'wish_created',
          value: 1,
          tags: {
            ...baseTagsString,
            wishId: this.extractWishId(wishEvent.wishId),
            hasAuthor: this.extractUserId(wishEvent.authorId) ? 'true' : 'false'
          },
          timestamp
        }];

      case 'WishSupported':
        const supportEvent = event as WishSupportedEvent;
        return [{
          name: 'wish_supported',
          value: 1,
          tags: {
            ...baseTagsString,
            wishId: this.extractWishId(supportEvent.wishId),
            supportCount: this.extractSupportCount(supportEvent.newSupportCount).toString(),
            supporterType: this.getSupporterType(supportEvent.supporter)
          },
          timestamp
        }];

      case 'WishSupportRemoved':
        const unsupportEvent = event as WishSupportRemovedEvent;
        return [{
          name: 'wish_support_removed',
          value: 1,
          tags: {
            ...baseTagsString,
            wishId: this.extractWishId(unsupportEvent.wishId),
            supportCount: this.extractSupportCount(unsupportEvent.newSupportCount).toString(),
            supporterType: this.getSupporterType(unsupportEvent.supporter)
          },
          timestamp
        }];

      case 'UserRegistered':
        const userEvent = event as UserRegisteredEvent;
        return [{
          name: 'user_registered',
          value: 1,
          tags: {
            ...baseTagsString,
            userId: this.extractUserIdFromUser(userEvent.user).toString(),
            hasName: userEvent.user.displayName ? 'true' : 'false'
          },
          timestamp
        }];

      default:
        Logger.warn(`[SIMPLE_ANALYTICS_OBSERVER] Unknown event type: ${event.eventName}`);
        return [];
    }
  }

  /**
   * Helper methods to extract values from value objects
   */
  private extractWishId(wishId: any): string {
    return wishId?.value || wishId?.toString() || 'unknown';
  }

  private extractUserId(userId: any): number | null {
    if (userId && typeof userId === 'object' && userId.value) {
      return userId.value;
    }
    if (typeof userId === 'number') {
      return userId;
    }
    return null;
  }

  private extractUserIdFromUser(user: any): number {
    if (user?.id && typeof user.id === 'object' && user.id.value) {
      return parseInt(user.id.value) || 0;
    }
    return user?.id || 0;
  }

  private extractSupportCount(supportCount: any): number {
    if (supportCount && typeof supportCount === 'object' && typeof supportCount.value === 'number') {
      return supportCount.value;
    }
    if (typeof supportCount === 'number') {
      return supportCount;
    }
    return 0;
  }

  private getSupporterType(supporter: any): string {
    if (supporter && typeof supporter === 'object') {
      return supporter.type || 'unknown';
    }
    return 'unknown';
  }
}

/**
 * Simple analytics error
 */
export class SimpleAnalyticsError extends ApplicationError {
  readonly code = 'SIMPLE_ANALYTICS_ERROR';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly eventName: string,
    cause?: Error
  ) {
    super(message, { eventName }, cause);
  }
}