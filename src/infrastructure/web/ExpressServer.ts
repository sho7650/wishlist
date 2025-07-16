// src/infrastructure/web/ExpressServer.ts
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import { WishController } from "../../adapters/primary/ExpressWishController";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { ExpressAuthenticationAdapter } from "../../adapters/primary/ExpressAuthenticationAdapter";
import { configureExpressPassport } from "../../config/express-passport";
import { BaseWebServer, RouteDefinition } from "./BaseWebServer";
import { MiddlewareConfigurationFactory } from "./MiddlewareConfigurationFactory";

export class ExpressServer extends BaseWebServer {
  private app: express.Application;

  constructor(
    dbConnection: any,
    wishController: WishController,
    authenticationAdapter?: ExpressAuthenticationAdapter
  ) {
    super(dbConnection, wishController, authenticationAdapter);
    
    // Initialize Express app first
    this.app = express();
    
    // Then initialize the server using the Template Method
    this.initializeServer();
  }

  // Template Method Pattern implementations
  protected getFrameworkName(): string {
    return "EXPRESS";
  }

  protected getApp(): any {
    return this.app;
  }

  protected setupFrameworkSpecificMiddleware(): void {
    this.app.use(express.json());
    this.app.use(cookieParser());
  }

  protected applySecurityMiddleware(config: any): void {
    this.app.use(helmet.contentSecurityPolicy(config));
  }

  protected applySessionMiddleware(config: any): void {
    this.app.use(session(config));
  }

  protected applyAuthenticationMiddleware(): void {
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  protected addRoute(route: RouteDefinition): void {
    const middleware = [];
    
    // Add authentication middleware if required
    if (route.requireAuth) {
      middleware.push(this.createAuthMiddleware());
    }
    
    // Add any custom middleware
    if (route.middleware) {
      middleware.push(...route.middleware);
    }

    // Add the handler
    middleware.push(route.handler);

    // Apply route to Express app
    switch (route.method) {
      case 'GET':
        this.app.get(route.path, ...middleware);
        break;
      case 'POST':
        this.app.post(route.path, ...middleware);
        break;
      case 'PUT':
        this.app.put(route.path, ...middleware);
        break;
      case 'DELETE':
        this.app.delete(route.path, ...middleware);
        break;
    }
  }

  protected createAuthMiddleware(): any {
    return (req: any, res: any, next: any) => {
      if (req.isAuthenticated()) {
        return next();
      }
      res.status(401).send("Unauthorized");
    };
  }

  protected configureStaticFiles(): void {
    this.app.use(express.static(this.getStaticFilesPath()));
  }

  protected configureSPAFallback(): void {
    this.app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      res.sendFile(this.getIndexHtmlPath());
    });
  }

  // Authentication handler implementations
  protected createGoogleAuthHandler(): any {
    const config = MiddlewareConfigurationFactory.createGoogleOAuthScope();
    return passport.authenticate("google", { scope: config });
  }

  protected createGoogleCallbackHandler(): any {
    const config = MiddlewareConfigurationFactory.createOAuthRedirectConfiguration();
    return passport.authenticate("google", config);
  }

  protected createLogoutHandler(): any {
    return (req: any, res: any) => {
      req.logout(() => {
        res.redirect("/");
      });
    };
  }

  protected createUserInfoHandler(): any {
    return (req: any, res: any) => {
      res.send(req.user);
    };
  }

  protected configurePassportWithAdapter(): void {
    if (!this.authenticationAdapter) return;

    // Configure Passport serialization using the adapter
    passport.serializeUser((user: any, done) => {
      this.authenticationAdapter!.serializeUser(user, done);
    });

    passport.deserializeUser((id: string, done) => {
      this.authenticationAdapter!.deserializeUser(id, done);
    });

    // Configure Google Strategy using the adapter
    const oauthConfig = MiddlewareConfigurationFactory.createGoogleOAuthConfiguration();
    passport.use(
      new GoogleStrategy(oauthConfig, (accessToken, refreshToken, profile, done) => {
        this.authenticationAdapter!.handleGoogleCallback(
          accessToken,
          refreshToken,
          profile,
          done
        );
      })
    );
  }

  protected configureLegacyPassport(): void {
    configureExpressPassport(this.dbConnection);
  }
}
