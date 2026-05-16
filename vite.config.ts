import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Manual chunk strategy — split heavy 3D libs into their own
        // chunk so recipient-viewer page (the highest-stakes mobile
        // first-paint moment) doesn't ship Three.js inline. Comms PR2
        // follow-up, 2026-04-30.
        //
        // Why manualChunks not React.lazy():
        // Card3DViewer is statically imported by 3 studio surfaces
        // (review step, studio card view, studio empty-state hero) AND
        // dynamically imported by the recipient viewer. When a module
        // has any static import, Vite refuses to move it to a separate
        // chunk just for the dynamic caller — see the build warning.
        // manualChunks bypasses that by forcing Three + drei + r3f
        // into their own chunk regardless of import style. The
        // recipient viewer's React.lazy() then triggers a real chunk
        // download instead of a no-op.
        manualChunks: (id) => {
          // Three.js + react-three-fiber + drei + lottie — the heavy
          // 3D / animation stack. ~150-200KB combined; recipient
          // viewer pays for it on demand instead of upfront.
          if (
            id.includes('node_modules/three/') ||
            id.includes('node_modules/@react-three/') ||
            id.includes('node_modules/lottie-react/') ||
            id.includes('node_modules/lottie-web/')
          ) {
            return 'three-stack';
          }
          // face-api was already split by Vite into its own chunk via
          // dynamic import in the photo step. Leaving it alone — the
          // tooling handles it correctly when there's no competing
          // static import elsewhere.
        },
      },
    },
    // Bump the warning ceiling to reflect our actual main chunk size
    // post-split. Keeps the build output readable; doesn't impact
    // runtime.
    chunkSizeWarningLimit: 800,
  },
});
