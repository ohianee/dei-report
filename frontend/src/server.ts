import {AngularNodeAppEngine, createNodeRequestHandler, 
  isMainModule, writeResponseToNodeResponse,} from '@angular/ssr/node';
import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by'); // Arreglo: divulga info (X-Powered-By: Express)

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

app.use((req, res, next) => {
  res.locals['nonce'] = crypto.randomBytes(16).toString('base64');
  next();
});

/**
 * Serve static files from /browser
 */
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals['nonce']}'`],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "http://localhost:8000", "http://localhost:8001"],
        frameAncestors: ["'none'"],  
      },
    },
    crossOriginEmbedderPolicy: false,
  })(req, res, next);
});

app.use(
  express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (response) {
        const html = await response.text(); 
        const modifiedHtml = html.replace(/NONCE_PLACEHOLDER/g, res.locals['nonce']);
        const modifiedResponse = new Response(modifiedHtml, {
          status: response.status,
          headers: response.headers
        });
        writeResponseToNodeResponse(modifiedResponse, res);
      } else {
        next();
      }
    })
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
