// src/infrastructure/web/BaseWebServer.ts

import path from "path";
import { WebServer } from "./WebServer";
import { Logger } from "../../utils/Logger";
import { SecurityConfigurationFactory } from "./SecurityConfigurationFactory";
import { MiddlewareConfigurationFactory } from "./MiddlewareConfigurationFactory";
import { DatabaseConnection } from "../db/DatabaseConnection";

export type RequestHandler = (req: any, res: any, next?: any) => void | Promise<void>;
export type Middleware = (req: any, res: any, next: any) => void | Promise<void>;

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: RequestHandler;
  middleware?: Middleware[];
  requireAuth?: boolean;
}

export abstract class BaseWebServer implements WebServer {
  protected dbConnection: DatabaseConnection;
  protected wishController: any; // TODO: Create specific WishController interface
  protected authenticationAdapter?: any; // TODO: Create specific AuthenticationAdapter interface

  constructor(dbConnection: DatabaseConnection, wishController: any, authenticationAdapter?: any) {
    this.dbConnection = dbConnection;
    this.wishController = wishController;
    this.authenticationAdapter = authenticationAdapter;
  }

  /**
   * Template Method - defines the server initialization algorithm
   * Must be called by concrete classes after their framework-specific setup
   */
  protected initializeServer(): void {
    this.setupSecurityMiddleware();
    this.setupSessionMiddleware();
    this.setupAuthenticationMiddleware();
    this.setupFrameworkSpecificMiddleware();
    this.configureAuthentication();
    this.setupRoutes();
  }

  // Abstract methods - must be implemented by concrete classes
  protected abstract getFrameworkName(): string;
  protected abstract getApp(): any;
  protected abstract setupFrameworkSpecificMiddleware(): void;
  protected abstract applySecurityMiddleware(config: any): void;
  protected abstract applySessionMiddleware(config: any): void;
  protected abstract applyAuthenticationMiddleware(): void;
  protected abstract addRoute(route: RouteDefinition): void;
  protected abstract configureSPAFallback(): void;
  protected abstract configureStaticFiles(): void;
  protected abstract configurePassportWithAdapter(): void;
  protected abstract configureLegacyPassport(): void;

  // Concrete methods - shared implementations
  protected setupSecurityMiddleware(): void {
    const cspConfig = SecurityConfigurationFactory.createCSPConfiguration();
    this.applySecurityMiddleware(cspConfig);
  }

  protected setupSessionMiddleware(): void {
    const sessionConfig = MiddlewareConfigurationFactory.createSessionConfiguration();
    this.applySessionMiddleware(sessionConfig);
  }

  protected setupAuthenticationMiddleware(): void {
    this.applyAuthenticationMiddleware();
  }

  protected configureAuthentication(): void {
    if (this.authenticationAdapter) {
      this.configurePassportWithAdapter();
    } else {
      this.configureLegacyPassport();
    }
  }

  protected setupRoutes(): void {
    this.setupAuthenticationRoutes();
    this.setupWishRoutes();
    this.setupSupportRoutes();
    this.configureStaticFiles();
    this.configureSPAFallback();
  }

  protected setupAuthenticationRoutes(): void {
    // Google OAuth initiation
    this.addRoute({
      method: 'GET',
      path: '/auth/google',
      handler: this.createGoogleAuthHandler(),
    });

    // Google OAuth callback
    this.addRoute({
      method: 'GET',
      path: '/auth/google/callback',
      handler: this.createGoogleCallbackHandler(),
    });

    // Logout
    this.addRoute({
      method: 'GET',
      path: '/auth/logout',
      handler: this.createLogoutHandler(),
    });

    // Current user info
    this.addRoute({
      method: 'GET',
      path: '/api/user',
      handler: this.createUserInfoHandler(),
    });
  }

  protected setupWishRoutes(): void {
    // Protected routes (require authentication)
    this.addRoute({
      method: 'POST',
      path: '/api/wishes',
      handler: this.wishController.createWish,
      requireAuth: true,
    });

    this.addRoute({
      method: 'PUT',
      path: '/api/wishes',
      handler: this.wishController.updateWish,
      requireAuth: true,
    });

    // Public routes
    this.addRoute({
      method: 'GET',
      path: '/api/wishes/current',
      handler: this.wishController.getCurrentWish,
    });

    this.addRoute({
      method: 'GET',
      path: '/api/wishes',
      handler: this.wishController.getLatestWishes,
    });

    this.addRoute({
      method: 'GET',
      path: '/api/user/wish',
      handler: this.wishController.getUserWish,
    });
  }

  protected setupSupportRoutes(): void {
    this.addRoute({
      method: 'POST',
      path: '/api/wishes/:wishId/support',
      handler: this.wishController.supportWish,
    });

    this.addRoute({
      method: 'DELETE',
      path: '/api/wishes/:wishId/support',
      handler: this.wishController.unsupportWish,
    });

    this.addRoute({
      method: 'GET',
      path: '/api/wishes/:wishId/support',
      handler: this.wishController.getWishSupportStatus,
    });
  }

  // Abstract methods for authentication handlers - framework-specific
  protected abstract createGoogleAuthHandler(): any;
  protected abstract createGoogleCallbackHandler(): any;
  protected abstract createLogoutHandler(): any;
  protected abstract createUserInfoHandler(): any;

  // Common server startup logic
  public start(port: number): void {
    this.getApp().listen(port, () => {
      Logger.info(`[${this.getFrameworkName()}] Server running on port ${port}`);
    });
  }

  protected getStaticFilesPath(): string {
    return path.join(__dirname, "../../../public");
  }

  protected getIndexHtmlPath(): string {
    return path.join(__dirname, "../../../public/index.html");
  }
}