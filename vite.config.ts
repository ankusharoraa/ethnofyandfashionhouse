import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: isDev
      ? {
          host: "::",
          port: 8080,
          hmr: { overlay: false },
        }
      : undefined,

    build: {
      outDir: "dist",
      sourcemap: false,
      minify: "esbuild",
      cssMinify: true,
      target: "es2018",

      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            vendor: ["react-router-dom"],
          },
        },
      },
    },
  };
});
