import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "../src/marimo_cad/static",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      formats: ["es"],
      fileName: () => "widget.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "widget.css";
          }
          return assetInfo.name;
        },
      },
    },
    sourcemap: false,
    minify: "esbuild",
  },
});
