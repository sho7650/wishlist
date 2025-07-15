// src/infrastructure/web/KoaServer.ts

import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import helmet from "koa-helmet";
import path from "path";
import fs from "fs";
import { KoaWishAdapter } from "../../adapters/primary/KoaWishAdapter";
import session from "koa-session";
import koaPassport from "koa-passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { KoaAuthenticationAdapter } from "../../adapters/primary/KoaAuthenticationAdapter";
import { configureKoaPassport } from "../../config/koa-passport";
import { BaseWebServer, RouteDefinition } from "./BaseWebServer";
import { MiddlewareConfigurationFactory } from "./MiddlewareConfigurationFactory";

export class KoaServer extends BaseWebServer {
  private app: Koa;
  private router: Router;

  constructor(
    dbConnection: any,
    koaWishAdapter: KoaWishAdapter,
    authenticationAdapter?: KoaAuthenticationAdapter
  ) {
    super(dbConnection, koaWishAdapter, authenticationAdapter);
    
    // Initialize Koa app and router after calling super
    this.app = new Koa();
    this.router = new Router();
    this.app.keys = MiddlewareConfigurationFactory.createSessionKeys();
    
    // Then initialize the server using the Template Method
    this.initializeServer();
  }

  // Template Method Pattern implementations
  protected getFrameworkName(): string {
    return "KOA";
  }

  protected getApp(): any {
    return this.app;
  }

  protected setupFrameworkSpecificMiddleware(): void {
    this.app.use(bodyParser());
  }

  protected applySecurityMiddleware(config: any): void {
    this.app.use(helmet.contentSecurityPolicy(config));
  }

  protected applySessionMiddleware(config: any): void {
    this.app.use(session({}, this.app));
  }

  protected applyAuthenticationMiddleware(): void {
    this.app.use(koaPassport.initialize());
    this.app.use(koaPassport.session());
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

    // Apply route to Koa router
    switch (route.method) {
      case 'GET':
        this.router.get(route.path, ...middleware);
        break;
      case 'POST':
        this.router.post(route.path, ...middleware);
        break;
      case 'PUT':
        this.router.put(route.path, ...middleware);
        break;
      case 'DELETE':
        this.router.delete(route.path, ...middleware);
        break;
    }
  }

  protected createAuthMiddleware(): Koa.Middleware {
    return async (ctx, next) => {
      if (ctx.isAuthenticated()) {
        await next();
      } else {
        ctx.status = 401;
        ctx.body = { error: "Unauthorized" };
      }
    };
  }

  protected configureStaticFiles(): void {
    this.app.use(serve(this.getStaticFilesPath()));
  }

  protected configureSPAFallback(): void {
    // Apply router middleware first
    this.app.use(this.router.routes()).use(this.router.allowedMethods());

    // Then add SPA fallback
    this.app.use(async (ctx) => {
      if (ctx.status === 404 && !ctx.path.startsWith("/api/")) {
        ctx.type = "html";
        ctx.body = fs.createReadStream(this.getIndexHtmlPath());
      }
    });
  }

  // Authentication handler implementations
  protected createGoogleAuthHandler(): any {
    const config = MiddlewareConfigurationFactory.createGoogleOAuthScope();
    return koaPassport.authenticate("google", { scope: config });
  }

  protected createGoogleCallbackHandler(): any {
    const config = MiddlewareConfigurationFactory.createOAuthRedirectConfiguration();
    return koaPassport.authenticate("google", config);
  }

  protected createLogoutHandler(): any {
    return async (ctx: Koa.Context) => {
      ctx.logout();
      ctx.redirect("/");
    };
  }

  protected createUserInfoHandler(): any {
    return (ctx: Koa.Context) => {
      ctx.body = ctx.state.user || null;
    };
  }

  protected configurePassportWithAdapter(): void {
    if (!this.authenticationAdapter) return;

    // Configure Passport serialization using the adapter
    koaPassport.serializeUser((user: any, done) => {
      this.authenticationAdapter!.serializeUser(user, done);
    });

    koaPassport.deserializeUser((id: string, done) => {
      this.authenticationAdapter!.deserializeUser(id, done);
    });

    // Configure Google Strategy using the adapter
    const oauthConfig = MiddlewareConfigurationFactory.createGoogleOAuthConfiguration();
    koaPassport.use(
      new GoogleStrategy(oauthConfig, (accessToken, refreshToken, profile, done) => {
        this.authenticationAdapter!.handleGoogleCallback(accessToken, refreshToken, profile, done);
      })
    );
  }

  protected configureLegacyPassport(): void {
    configureKoaPassport(this.dbConnection);
  }
}
