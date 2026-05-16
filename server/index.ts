// server/index.ts
// Make sure env vars from .env are loaded BEFORE anything else uses process.env
import "dotenv/config";

import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Increase server timeout for complex AI processing
// NOTE: Express doesn't officially expose app.timeout; server.timeout below is what matters.
(app as any).timeout = 600000; // 10 minute timeout

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = ((bodyJson: any) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  }) as any;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Set server timeout for long-running AI processing
  server.timeout = 600000; // 10 minute timeout
  server.keepAliveTimeout = 65000; // Keep alive timeout
  server.headersTimeout = 66000; // Headers timeout

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";

    res.status(status).json({ message });

    // Keep existing behavior: surface the error in dev logs/stack
    throw err;
  });

  // Serve static files from client/public directory
  app.use(express.static(path.join(import.meta.dirname, "..", "client", "public")));

  // Only setup vite in development, and after registering API routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000 (Replit convention)
  const port = Number(process.env.PORT) || 5050;

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Server will attempt to restart automatically.`);
      setTimeout(() => process.exit(1), 1000);
    } else {
      console.error("Server error:", err);
      throw err;
    }
  });

  // Graceful shutdown handlers
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Bind host. Defaults to "0.0.0.0" (IPv4 all-interfaces) which is what
  // Replit / Render / most deploy targets expect. Override locally with
  // HOST=:: for dual-stack (IPv4 + IPv6) so http://localhost works on
  // macOS systems that resolve `localhost` to ::1 first.
  const host = process.env.HOST ?? "0.0.0.0";
  server.listen(port, host, () => {
    log(`serving on ${host}:${port}`);
  });
})();