import "dotenv/config";

// 读取环境变量：缺失时只告警不抛错——避免服务在启动时整体崩溃
// （缺 DATABASE_URL 时数据库请求会各自失败并返回明确错误，但静态页与健康接口仍可用）
function read(name: string): string {
  const value = process.env[name];
  if (!value) console.warn(`[env] 缺少环境变量 ${name}，相关功能将不可用`);
  return value ?? "";
}

export const env = {
  appId: read("APP_ID"),
  appSecret: read("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: read("DATABASE_URL"),
};
