/**
 * Result Pattern Implementation
 * Provides type-safe error handling without exceptions
 */

/**
 * Result type that can contain either success or failure
 */
export type Result<T, E = Error> = {
  readonly success: true;
  readonly data: T;
} | {
  readonly success: false;
  readonly error: E;
};

/**
 * Result utility functions
 */
export class ResultUtils {
  /**
   * Create a successful result
   */
  static ok<T>(data: T): Result<T, never> {
    return {
      success: true,
      data
    };
  }

  /**
   * Create a failed result
   */
  static fail<E>(error: E): Result<never, E> {
    return {
      success: false,
      error
    };
  }

  /**
   * Check if result is successful
   */
  static isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success;
  }

  /**
   * Check if result is failed
   */
  static isFail<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  }

  /**
   * Map successful result data
   */
  static map<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => U
  ): Result<U, E> {
    if (ResultUtils.isOk(result)) {
      return ResultUtils.ok(fn(result.data));
    }
    return result as Result<never, E>;
  }

  /**
   * Map failed result error
   */
  static mapError<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> {
    if (ResultUtils.isFail(result)) {
      return ResultUtils.fail(fn(result.error));
    }
    return result as Result<T, never>;
  }

  /**
   * Chain results (flatMap)
   */
  static bind<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    if (ResultUtils.isOk(result)) {
      return fn(result.data);
    }
    return result as Result<never, E>;
  }

  /**
   * Get data from result or throw error
   */
  static unwrap<T, E>(result: Result<T, E>): T {
    if (ResultUtils.isOk(result)) {
      return result.data;
    }
    const errorResult = result as { success: false; error: E };
    throw errorResult.error;
  }

  /**
   * Get data from result or return default value
   */
  static unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (ResultUtils.isOk(result)) {
      return result.data;
    }
    return defaultValue;
  }

  /**
   * Get data from result or compute default value
   */
  static unwrapOrElse<T, E>(
    result: Result<T, E>,
    fn: (error: E) => T
  ): T {
    if (ResultUtils.isOk(result)) {
      return result.data;
    }
    const errorResult = result as { success: false; error: E };
    return fn(errorResult.error);
  }
}