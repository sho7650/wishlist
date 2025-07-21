/**
 * Observer Pattern Exports
 * Centralized exports for all observer-related classes
 */

// Core observer interfaces and base classes
export {
  EventObserver,
  BaseEventObserver,
  ObserverContext,
  ObserverResult,
  ObserverSubscription,
  ObserverExecutionStrategy,
  ObserverExecutionConfig,
  ObserverRegistry
} from './EventObserver';

// Event dispatcher
export {
  EventDispatcher,
  EventDispatchResult
} from './EventDispatcher';

// Error classes (from shared ApplicationError)
export {
  ObserverExecutionError,
  ObserverRegistrationError
} from '../../shared/ApplicationError';

// Simplified observer implementations (working versions)
export {
  SimpleNotificationObserver,
  SimpleNotification,
  SimpleNotificationService,
  ConsoleSimpleNotificationService,
  SimpleNotificationError
} from './concrete/SimpleNotificationObserver';

export {
  SimpleAnalyticsObserver,
  SimpleMetric,
  SimpleAnalyticsService,
  ConsoleSimpleAnalyticsService,
  SimpleAnalyticsError
} from './concrete/SimpleAnalyticsObserver';