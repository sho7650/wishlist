 CLAUDE.md

アーキテクチャ原則は @principles/architecture.md に記載しています。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

```bash
# Start development server with Express (default)
npm run dev

# Start development server with Koa
npm run dev:koa
```

### Build and Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server (after build)
npm start

# Start production server with Koa
npm start:koa
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Project Architecture

This is a **Tanabata Wish Board** application built with **Hexagonal Architecture (Ports and Adapters)** and **Domain-Driven Design (DDD)** principles.

### Core Architecture Layers

1. **Domain Layer** (`src/domain/`):

   - `entities/Wish.ts`: Core business entity with validation rules
   - `repositories/WishRepository.ts`: Repository interface

2. **Application Layer** (`src/application/usecases/`):

   - Use cases orchestrate business logic
   - `CreateWishUseCase`, `UpdateWishUseCase`, `GetLatestWishesUseCase`, etc.

3. **Infrastructure Layer** (`src/infrastructure/`):

   - `db/`: Database connections (PostgreSQL, SQLite)
   - `web/`: Web server implementations (Express, Koa)

4. **Adapters Layer** (`src/adapters/`):

   - `primary/`: Controllers handling HTTP requests
   - `secondary/`: Database repositories, session services

5. **Ports Layer** (`src/ports/`):
   - Interfaces defining communication contracts

### Key Design Patterns

- **Factory Pattern**: `WebServerFactory` and `DatabaseFactory` for framework/database selection
- **Strategy Pattern**: `ServerBuilderStrategy` for different web frameworks
- **Repository Pattern**: Database abstraction through repositories

### Framework Flexibility

The application supports multiple web frameworks with PostgreSQL as the optimized database:

**Web Frameworks** (configurable via `WEB_FRAMEWORK` env var):

- Express.js (default)
- Koa.js

**Database**:

- PostgreSQL (high-performance, optimized for production)

### Environment Configuration

Key environment variables:

- `WEB_FRAMEWORK`: `express` or `koa`
- `DATABASE_URL`: PostgreSQL connection string (Heroku)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: wishlist)
- `DB_USER`: Database user (default: postgres)
- `DB_PASSWORD`: Database password (default: password)
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging level - `error`, `warn`, `info`, `debug` (default: `error` in production, `info` in development)

### Logging Configuration

The application uses a hierarchical logging system controlled by the `LOG_LEVEL` environment variable:

- `error`: Only error messages (default in production)
- `warn`: Error and warning messages
- `info`: Error, warning, and informational messages (default in development)
- `debug`: All messages including detailed debug information

To enable debug logging for troubleshooting support operations:

```bash
LOG_LEVEL=debug npm run dev
```

### Testing Structure

Tests are organized by architecture layer:

- `tests/unit/`: Unit tests mirroring src structure
- `tests/integration/`: Integration tests
- `tests/e2e/`: End-to-end tests

### Running Single Tests

```bash
# Run specific test file
npm test -- --testPathPattern="WishController.test.ts"

# Run tests for specific directory
npm test -- --testPathPattern="unit/application"
```

### Database Schema

The application uses PostgreSQL with optimized schema and indexes:

**Main Tables:**

- `users`: Google OAuth user management
- `wishes`: Core wish entities with support counting
- `sessions`: Anonymous user session tracking
- `supports`: Wish support system with uniqueness constraints

**Performance Optimizations:**

- Optimized indexes for fast queries
- PostgreSQL-specific CTE queries for atomic operations
- Connection pooling for high concurrency
- Unique constraints to prevent duplicate support

**Wish Entity Fields:**

- `id`: UUID primary key
- `name`: Optional user name (max 64 chars)
- `wish`: Wish text (1-240 chars)
- `userId`: Optional user ID for authenticated users
- `supportCount`: Real-time support count
- `createdAt`: Timestamp
