import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { injectSeo } from "./seo-inject";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true as const,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      // NOTE: the previous version appended `?v=${nanoid()}` to the
      // main.tsx src on every request — Replit-era cache-buster. It
      // forced Vite to re-transform the entire module graph on every
      // navigation, killing the in-memory module cache and adding
      // seconds to every reload. Removed 2026-05-13. Vite handles
      // HMR + ETag/304 invalidation correctly on its own.
      const page = await vite.transformIndexHtml(url, template);
      // Same SEO/OG rewriting as prod (serveStatic below) — without this,
      // dev serves base metadata on every path, so share-link previews
      // and canonicals can't be verified locally with curl.
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(injectSeo(page, url.split("?")[0]));
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Cache policy exists for Cloudflare's benefit: prod sits behind CF,
  // and express's default max-age=0 forbade ALL edge caching — the
  // 1.4MB three-stack chunk was fetched from the Render origin on
  // every single visit (8.7s measured from SA). Vite content-hashes
  // everything under /assets, so those are immutable; other build
  // outputs (favicons, public/ copies) get a day.
  app.use(
    express.static(distPath, {
      // index.html must NOT be served by this mount with a long
      // max-age — deploys would go stale at the edge. The catch-all
      // below serves it with no-cache (etag revalidation only).
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    }),
  );

  // Fall through to index.html for app routes — with per-path SEO
  // metadata injected (title/description/canonical/OG from
  // shared/seo.ts). The template is read once at boot; the transform is
  // a handful of anchored string replacements per request. See
  // server/seo-inject.ts for why this exists (the SPA served the
  // homepage's canonical on EVERY route, telling Google the whole site
  // was one page).
  const indexTemplate = fs.readFileSync(
    path.resolve(distPath, "index.html"),
    "utf-8",
  );
  app.use("*", (req, res) => {
    res.set("Cache-Control", "no-cache");
    res
      .status(200)
      .set({ "Content-Type": "text/html" })
      .end(injectSeo(indexTemplate, req.originalUrl.split("?")[0]));
  });
}
