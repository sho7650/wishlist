/**
 * Application Error Hierarchy
 * Provides structured error handling across the application
 */

/**
 * Base application error class
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Domain errors - business logic violations
 */
export class DomainError extends ApplicationError {
  readonly code = 'DOMAIN_ERROR';
  readonly statusCode = 400;
}

/**
 * Validation errors - input validation failures
 */
export class ValidationError extends ApplicationError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, field, value }, cause);
  }
}

/**
 * Not found errors - resource not found
 */
export class NotFoundError extends ApplicationError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(
    message: string,
    public readonly resource?: string,
    public readonly identifier?: string | number,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, resource, identifier }, cause);
  }
}

/**
 * Permission errors - authorization failures
 */
export class PermissionError extends ApplicationError {
  readonly code = 'PERMISSION_DENIED';
  readonly statusCode = 403;
  
  constructor(
    message: string,
    public readonly action?: string,
    public readonly resource?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, action, resource }, cause);
  }
}

/**
 * Infrastructure errors - external system failures
 */
export class InfrastructureError extends ApplicationError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly statusCode = 503;
  
  constructor(
    message: string,
    public readonly service?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, service }, cause);
  }
}

/**
 * Configuration errors - setup/config issues
 */
export class ConfigurationError extends ApplicationError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly setting?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, setting }, cause);
  }
}

/**
 * Rate limit errors - too many requests
 */
export class RateLimitError extends ApplicationError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  
  constructor(
    message: string,
    public readonly limit?: number,
    public readonly windowMs?: number,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, limit, windowMs }, cause);
  }
}

/**
 * Conflict errors - resource conflicts
 */
export class ConflictError extends ApplicationError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
  
  constructor(
    message: string,
    public readonly conflictingResource?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, conflictingResource }, cause);
  }
}

/**
 * Timeout errors - operation timeouts
 */
export class TimeoutError extends ApplicationError {
  readonly code = 'TIMEOUT';
  readonly statusCode = 504;
  
  constructor(
    message: string,
    public readonly timeoutMs?: number,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, timeoutMs }, cause);
  }
}

/**
 * Observer execution specific errors
 */
export class ObserverExecutionError extends ApplicationError {
  readonly code = 'OBSERVER_EXECUTION_ERROR';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly observerId?: string,
    public readonly eventName?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, observerId, eventName }, cause);
  }
}

/**
 * Observer registration errors
 */
export class ObserverRegistrationError extends ApplicationError {
  readonly code = 'OBSERVER_REGISTRATION_ERROR';
  readonly statusCode = 500;
  
  constructor(
    message: string,
    public readonly observerId?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { ...context, observerId }, cause);
  }
}