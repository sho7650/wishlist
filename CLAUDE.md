# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
# Start development server with Express (default)
npm run dev

# Start development server with Koa
npm run dev:koa

# Start development server with PostgreSQL
npm run dev:pg
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

The application supports multiple web frameworks and databases:

**Web Frameworks** (configurable via `WEB_FRAMEWORK` env var):
- Express.js (default)
- Koa.js

**Databases** (auto-detected via environment):
- PostgreSQL (production, triggered by `DATABASE_URL` env var)
- SQLite (development, default)

### Environment Configuration

Key environment variables:
- `WEB_FRAMEWORK`: `express` or `koa`
- `DB_TYPE`: `sqlite` or `postgres`
- `DATABASE_URL`: PostgreSQL connection string (Heroku)
- `PORT`: Server port (default: 3000)

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

The application manages a simple wish entity with:
- `id`: UUID primary key
- `name`: Optional user name (max 64 chars)
- `wish`: Wish text (1-240 chars)
- `userId`: Optional user ID for authenticated users
- `createdAt`: Timestamp

Session management tracks wish ownership through session IDs.