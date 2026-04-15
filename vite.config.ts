import { defineConfig } from "vite"
import path from "node:path"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      lib: path.resolve(__dirname, "lib"),
      components: path.resolve(__dirname, "components"),
      tests: path.resolve(__dirname, "tests"),
      pages: path.resolve(__dirname, "pages"),
      utils: path.resolve(__dirname, "utils"),
    },
  },
})
