import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { sessions, users, type User } from "@db/schema";

/** 当前登录用户（脱敏：不含 passwordHash） */
export type AuthUser = Pick<
  User,
  "id" | "username" | "displayName" | "role" | "projectId" | "status"
>;

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  /** 当前登录用户；未登录/会话失效为 null */
  user: AuthUser | null;
  /** 当前会话 token（供 logout 删除会话用） */
  token: string | null;
};

/** 从请求中解析 token：优先 Authorization: Bearer，其次 cookie geomon_token */
function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const cookie = req.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === "geomon_token") {
        const t = decodeURIComponent(v.join("=")).trim();
        if (t) return t;
      }
    }
  }
  return null;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const token = extractToken(opts.req);
  let user: AuthUser | null = null;
  if (token) {
    const db = getDb();
    // 会话存在、未过期，且账号处于启用状态才视为已登录
    const [row] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date()),
          eq(users.status, "active"),
        ),
      )
      .limit(1);
    if (row) {
      const { id, username, displayName, role, projectId, status } = row.user;
      user = { id, username, displayName, role, projectId, status };
    }
  }
  return { req: opts.req, resHeaders: opts.resHeaders, user, token };
}
