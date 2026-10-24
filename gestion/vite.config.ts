import { personalizationAssetsPlugin } from "./personalizationAssetsPlugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react(), personalizationAssetsPlugin()],
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    proxy: {
      '/commerce-api/api/admin/orders/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/commerce-api/, ''),
        headers: { origin: 'http://localhost:5181' },
      },
    },
  },
  envDir: "..",
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules"))
            return id.includes("recharts") || id.includes("d3-")
              ? "charts"
              : "vendor";
        },
      },
    },
  },
});
