import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    // inspectAttr 仅开发态启用：往 DOM 写源码定位属性，不应进生产产物
    ...(command === "serve" ? [inspectAttr()] : []),
    react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 大依赖独立分包：首屏只加载框架与首屏路由，echarts/framer/radix 按需加载
        manualChunks: {
          echarts: ["echarts"],
          "react-vendor": ["react", "react-dom", "react-router"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query", "@trpc/client", "@trpc/react-query", "superjson"],
        },
      },
    },
  },
}));
