/**
 * Simple Observer Pattern Examples
 * Demonstrates basic usage without complex value object handling
 */

import { 
  EventDispatcher,
  BaseEventObserver,
  ObserverContext,
  ObserverResult
} from "../index";
import { DomainEvent } from "../../DomainEvent";
import { Logger } from "../../../../utils/Logger";

// Simple test event for demonstrations
class TestEvent extends DomainEvent {
  constructor(public readonly testData: string) {
    super();
  }

  get eventName(): string {
    return 'TestEvent';
  }
}

/**
 * Example 1: Basic observer registration and event dispatch
 */
export async function basicObserverExample() {
  console.log('\n=== Basic Observer Example ===');

  // Create event dispatcher
  const dispatcher = new EventDispatcher();

  // Create simple test observer
  class TestObserver extends BaseEventObserver {
    constructor(id: string, name: string) {
      super(id, name, ['TestEvent'], 5, true);
    }

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log(`✅ ${this.observerName} handled event: ${event.eventName}`);
      return this.success({ processed: true });
    }
  }

  // Register observers
  const observer1 = new TestObserver('test-1', 'Test Observer 1');
  const observer2 = new TestObserver('test-2', 'Test Observer 2');

  await dispatcher.register(observer1);
  await dispatcher.register(observer2);

  console.log(`Registered ${dispatcher.getAllObservers().length} observers`);

  // Create and dispatch a test event
  const testEvent = new TestEvent('Hello World');
  const result = await dispatcher.dispatch(testEvent);

  console.log('Dispatch Result:');
  console.log(`- Total observers: ${result.totalObservers}`);
  console.log(`- Successful: ${result.successfulObservers}`);
  console.log(`- Failed: ${result.failedObservers}`);
  console.log(`- Execution time: ${result.totalExecutionTime}ms`);

  // Cleanup
  await dispatcher.clear();
}

/**
 * Example 2: Observer priority and execution order
 */
export async function observerPriorityExample() {
  console.log('\n=== Observer Priority Example ===');

  const dispatcher = new EventDispatcher();

  // Create observers with different priorities
  class PriorityObserver extends BaseEventObserver {
    constructor(id: string, priority: number) {
      super(id, `Priority ${priority} Observer`, ['TestEvent'], priority, true);
    }

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log(`📋 ${this.observerName} (priority: ${this.priority}) executing`);
      return this.success();
    }
  }

  // Register observers (note: they execute in priority order, highest first)
  await dispatcher.register(new PriorityObserver('low', 1));
  await dispatcher.register(new PriorityObserver('high', 10));
  await dispatcher.register(new PriorityObserver('medium', 5));

  console.log('Dispatching event (observers should execute in priority order: 10, 5, 1)');
  const testEvent = new TestEvent('Priority Test');
  await dispatcher.dispatch(testEvent, { strategy: 'sequential' });

  await dispatcher.clear();
}

/**
 * Example 3: Error handling
 */
export async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  const dispatcher = new EventDispatcher();

  // Create observers that might fail
  class ReliableObserver extends BaseEventObserver {
    constructor() {
      super('reliable', 'Reliable Observer', ['TestEvent'], 10, true);
    }

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log('✅ Reliable observer processing successfully');
      return this.success({ status: 'success' });
    }
  }

  class FailingObserver extends BaseEventObserver {
    constructor() {
      super('failing', 'Failing Observer', ['TestEvent'], 5, true);
    }

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log('❌ Failing observer throwing error');
      throw new Error('Simulated failure');
    }
  }

  await dispatcher.register(new ReliableObserver());
  await dispatcher.register(new FailingObserver());

  const testEvent = new TestEvent('Error Test');
  const result = await dispatcher.dispatch(testEvent);

  console.log('\nResult with mixed success/failure:');
  console.log(`- Successful observers: ${result.successfulObservers}`);
  console.log(`- Failed observers: ${result.failedObservers}`);
  console.log(`- Errors: ${result.errors.length}`);

  result.errors.forEach((error, index) => {
    console.log(`  Error ${index + 1}: ${error.message}`);
  });

  await dispatcher.clear();
}

/**
 * Example 4: Execution strategies
 */
export async function executionStrategyExample() {
  console.log('\n=== Execution Strategy Example ===');

  const dispatcher = new EventDispatcher();

  // Create observers with simulated processing time
  class TimedObserver extends BaseEventObserver {
    constructor(id: string, delay: number) {
      super(id, `Timed Observer ${id}`, ['TestEvent'], Math.random() * 10, true);
      this.delay = delay;
    }

    private delay: number;

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log(`⏱️  ${this.observerName} starting (${this.delay}ms delay)`);
      await new Promise(resolve => setTimeout(resolve, this.delay));
      console.log(`✅ ${this.observerName} completed`);
      return this.success();
    }
  }

  // Register observers with different processing times
  await dispatcher.register(new TimedObserver('Fast', 50));
  await dispatcher.register(new TimedObserver('Medium', 100));
  await dispatcher.register(new TimedObserver('Slow', 200));

  const testEvent = new TestEvent('Strategy Test');

  console.log('\n--- Sequential Execution ---');
  const sequentialStart = Date.now();
  await dispatcher.dispatch(testEvent, { strategy: 'sequential' });
  console.log(`Sequential execution took: ${Date.now() - sequentialStart}ms\n`);

  console.log('--- Parallel Execution ---');
  const parallelStart = Date.now();
  await dispatcher.dispatch(testEvent, { strategy: 'parallel' });
  console.log(`Parallel execution took: ${Date.now() - parallelStart}ms\n`);

  console.log('--- Fire-and-Forget Execution ---');
  const fireForgetStart = Date.now();
  await dispatcher.dispatch(testEvent, { strategy: 'fire-and-forget' });
  console.log(`Fire-and-forget execution took: ${Date.now() - fireForgetStart}ms`);

  await dispatcher.clear();
}

/**
 * Example 5: Observer subscription management
 */
export async function subscriptionExample() {
  console.log('\n=== Subscription Management Example ===');

  const dispatcher = new EventDispatcher();

  class ManagedObserver extends BaseEventObserver {
    constructor(id: string) {
      super(id, `Managed Observer ${id}`, ['TestEvent'], 5, true);
    }

    protected async handleEvent(event: DomainEvent, context: ObserverContext): Promise<ObserverResult> {
      console.log(`📝 ${this.observerName} processing event`);
      return this.success();
    }
  }

  // Register observers and keep subscriptions
  const observer1 = new ManagedObserver('1');
  const observer2 = new ManagedObserver('2');
  const observer3 = new ManagedObserver('3');

  const subscription1 = await dispatcher.register(observer1);
  const subscription2 = await dispatcher.register(observer2);
  const subscription3 = await dispatcher.register(observer3);

  console.log(`Registered ${dispatcher.getAllObservers().length} observers`);

  // Test with all observers
  console.log('\n--- All observers active ---');
  await dispatcher.dispatch(new TestEvent('All Active'));

  // Unsubscribe one observer
  console.log('\n--- Unsubscribing observer 2 ---');
  await subscription2.unsubscribe();
  console.log(`Remaining observers: ${dispatcher.getAllObservers().length}`);

  await dispatcher.dispatch(new TestEvent('After Unsubscribe'));

  // Cleanup
  await dispatcher.clear();
}

/**
 * Example 6: Integration with EventBusAdapter
 */
export async function eventBusIntegrationExample() {
  console.log('\n=== Event Bus Integration Example ===');

  // Import EventBusAdapter
  const { EventBusAdapter } = require('../../../../adapters/secondary/events/EventBusAdapter');
  
  // Create event bus with observer mode enabled
  const eventBus = new EventBusAdapter(undefined, true);
  
  // Initialize default observers
  try {
    await eventBus.initializeDefaultObservers();
    
    // Get observer statistics
    const stats = await eventBus.getObserverStats();
    console.log('Observer Statistics:');
    console.log(`- Total observers: ${stats.totalObservers}`);
    console.log('- Registered observers:', stats.registeredObservers);

    // Test publishing through the event bus
    console.log('\n--- Publishing test event through EventBusAdapter ---');
    await eventBus.publish(new TestEvent('Integration Test'));

    // Cleanup
    await eventBus.cleanup();
  } catch (error) {
    console.error('Error in integration example:', error);
  }
}

/**
 * Run all simple observer examples
 */
export async function runAllSimpleObserverExamples() {
  console.log('🔗 Simple Observer Pattern Examples\n');
  
  try {
    await basicObserverExample();
    await observerPriorityExample();
    await errorHandlingExample();
    await executionStrategyExample();
    await subscriptionExample();
    await eventBusIntegrationExample();
    
    console.log('\n✅ All simple observer examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Error running simple observer examples:', error);
  }
}

// Export for direct execution
if (require.main === module) {
  runAllSimpleObserverExamples();
}