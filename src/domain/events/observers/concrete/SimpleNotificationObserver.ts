/**
 * Simplified Notification Observer Implementation
 * Handles basic notifications with value object compatibility
 */

import { BaseEventObserver, ObserverContext, ObserverResult } from "../EventObserver";
import { DomainEvent } from "../../DomainEvent";
import { WishCreatedEvent } from "../../WishCreatedEvent";
import { WishSupportedEvent } from "../../WishSupportedEvent";
import { UserRegisteredEvent } from "../../UserRegisteredEvent";
import { Logger } from "../../../../utils/Logger";
import { ApplicationError } from "../../../shared/ApplicationError";

/**
 * Simple notification data
 */
export interface SimpleNotification {
  id: string;
  type: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
}

/**
 * Simple notification service
 */
export interface SimpleNotificationService {
  send(notification: SimpleNotification): Promise<boolean>;
}

/**
 * Console notification service
 */
export class ConsoleSimpleNotificationService implements SimpleNotificationService {
  async send(notification: SimpleNotification): Promise<boolean> {
    console.log(`\n📢 [NOTIFICATION] ${notification.type}: ${notification.message}`);
    console.log(`   Data:`, notification.data);
    return true;
  }
}

/**
 * Simplified notification observer
 */
export class SimpleNotificationObserver extends BaseEventObserver {
  constructor(
    private notificationService: SimpleNotificationService = new ConsoleSimpleNotificationService()
  ) {
    super(
      'simple-notification-observer',
      'Simple Notification Observer',
      ['WishCreated', 'WishSupported', 'UserRegistered'],
      10, // High priority
      true // Async execution
    );
  }

  protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
    Logger.debug(`[SIMPLE_NOTIFICATION_OBSERVER] Processing ${event.eventName} event`, {
      eventId: context.eventId,
      eventName: event.eventName
    });

    try {
      const notifications = await this.createNotificationsForEvent(event);
      let sentCount = 0;

      for (const notification of notifications) {
        if (await this.notificationService.send(notification)) {
          sentCount++;
        }
      }

      Logger.info(`[SIMPLE_NOTIFICATION_OBSERVER] Sent ${sentCount}/${notifications.length} notifications for ${event.eventName}`, {
        eventId: context.eventId,
        sentCount,
        totalNotifications: notifications.length
      });

      return this.success({
        sentCount,
        totalNotifications: notifications.length
      });
    } catch (error) {
      Logger.error(`[SIMPLE_NOTIFICATION_OBSERVER] Failed to process notifications for ${event.eventName}`, error as Error);
      return this.failure(
        new SimpleNotificationError(
          `Failed to process notifications for ${event.eventName}`,
          event.eventName,
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }
  }

  /**
   * Create notifications based on event type
   */
  private async createNotificationsForEvent(event: DomainEvent): Promise<SimpleNotification[]> {
    const timestamp = new Date();

    switch (event.eventName) {
      case 'WishCreated':
        const wishEvent = event as WishCreatedEvent;
        const wishId = this.extractWishId(wishEvent.wishId);
        const authorId = this.extractUserId(wishEvent.authorId);
        
        return [{
          id: `wish-created-${wishId}-${timestamp.getTime()}`,
          type: 'wish_created',
          message: authorId ? '願い事を投稿しました' : '匿名で願い事が投稿されました',
          data: {
            wishId,
            authorId,
            createdAt: wishEvent.createdAt.toISOString()
          },
          timestamp
        }];

      case 'WishSupported':
        const supportEvent = event as WishSupportedEvent;
        const supportedWishId = this.extractWishId(supportEvent.wishId);
        const supportCount = this.extractSupportCount(supportEvent.newSupportCount);
        
        return [{
          id: `wish-supported-${supportedWishId}-${timestamp.getTime()}`,
          type: 'wish_supported',
          message: `願い事が応援されました！現在の応援数: ${supportCount}`,
          data: {
            wishId: supportedWishId,
            supportCount,
            supportedAt: supportEvent.supportedAt.toISOString()
          },
          timestamp
        }];

      case 'UserRegistered':
        const userEvent = event as UserRegisteredEvent;
        const userId = this.extractUserIdFromUser(userEvent.user);
        
        return [{
          id: `welcome-${userId}-${timestamp.getTime()}`,
          type: 'welcome',
          message: 'Tanabata Wishlist へようこそ！',
          data: {
            userId,
            userEmail: userEvent.user.email,
            userName: userEvent.user.displayName,
            registeredAt: userEvent.registeredAt.toISOString()
          },
          timestamp
        }];

      default:
        Logger.warn(`[SIMPLE_NOTIFICATION_OBSERVER] Unknown event type: ${event.eventName}`);
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
}

/**
 * Simple notification error
 */
export class SimpleNotificationError extends ApplicationError {
  readonly code = 'SIMPLE_NOTIFICATION_ERROR';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly eventName: string,
    cause?: Error
  ) {
    super(message, { eventName }, cause);
  }
}