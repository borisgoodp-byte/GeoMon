/**
 * 认证与账号管理路由（auth.*）
 * - login/logout/me：登录、登出、当前用户
 * - users.*（仅 admin）：账号列表 / 新建 / 停用启用 / 重置密码
 */

import { z } from "zod";
import { and, desc, eq, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  adminProcedure,
  authedProcedure,
  createRouter,
  publicQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import { projects, sessions, users, type User } from "@db/schema";
import { generateToken, hashPassword, verifyPassword } from "./lib/auth";

/** 会话有效期：30 天 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 登录限流：同一 用户名+IP 10 分钟内最多 10 次失败（内存实现，单实例部署够用） */
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;
const loginFails = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkLoginThrottle(key: string) {
  const rec = loginFails.get(key);
  if (rec && rec.resetAt > Date.now() && rec.count >= LOGIN_MAX_FAILS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "尝试次数过多，请 10 分钟后再试",
    });
  }
}

function recordLoginFail(key: string) {
  const now = Date.now();
  const rec = loginFails.get(key);
  if (!rec || rec.resetAt <= now) {
    loginFails.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    rec.count += 1;
  }
  // 防内存膨胀：惰性清理过期记录
  if (loginFails.size > 10_000) {
    for (const [k, v] of loginFails) if (v.resetAt <= now) loginFails.delete(k);
  }
}

/** 全局过期会话清扫节流：每次登录最多触发一次/小时 */
let lastSessionSweep = 0;

/** 脱敏用户视图（绝不下发 passwordHash） */
function toSafeUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    projectId: u.projectId,
    status: u.status,
    createdAt: u.createdAt,
  };
}

export const authRouter = createRouter({
  /** 登录：校验密码 → 签发 32 字节随机 token 写 sessions（30 天） */
  login: publicQuery
    .input(
      z.object({
        username: z.string().trim().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const throttleKey = `${input.username.toLowerCase()}|${clientIp(ctx.req)}`;
      checkLoginThrottle(throttleKey);
      const db = getDb();
      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      if (!u || !(await verifyPassword(input.password, u.passwordHash))) {
        recordLoginFail(throttleKey);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }
      if (u.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "账号已停用，请联系项目负责人",
        });
      }
      loginFails.delete(throttleKey);
      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await db.insert(sessions).values({ token, userId: u.id, expiresAt });

      // 过期会话清扫：清该用户的失效会话 + 每小时一次全表惰性清扫
      const now = Date.now();
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, u.id), lt(sessions.expiresAt, new Date())));
      if (now - lastSessionSweep > 60 * 60 * 1000) {
        lastSessionSweep = now;
        await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
      }

      // httpOnly cookie 兜底（前端仍以 Bearer 为主，cookie 供同源直开/后续迁移）
      const secure = new URL(ctx.req.url).protocol === "https:" ? "; Secure" : "";
      ctx.resHeaders.append(
        "Set-Cookie",
        `geomon_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`,
      );
      return { token, user: toSafeUser(u) };
    }),

  /** 登出：删除当前会话并清除 cookie */
  logout: authedProcedure.mutation(async ({ ctx }) => {
    if (ctx.token) {
      await getDb().delete(sessions).where(eq(sessions.token, ctx.token));
    }
    ctx.resHeaders.append(
      "Set-Cookie",
      "geomon_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
    );
    return { ok: true };
  }),

  /** 当前登录用户 */
  me: authedProcedure.query(({ ctx }) => ctx.user),

  /** 账号管理（仅 admin） */
  users: createRouter({
    /** 用户列表（含绑定项目名） */
    list: adminProcedure.query(async () => {
      const db = getDb();
      const rows = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          projectId: users.projectId,
          status: users.status,
          createdAt: users.createdAt,
          projectName: projects.name,
        })
        .from(users)
        .leftJoin(projects, eq(users.projectId, projects.id))
        .orderBy(desc(users.id));
      return rows;
    }),

    /** 新建账号：username 唯一；client 角色必须绑定项目 */
    create: adminProcedure
      .input(
        z.object({
          username: z
            .string()
            .trim()
            .min(2)
            .max(64)
            .regex(/^[a-zA-Z0-9_.-]+$/, "用户名仅允许字母、数字、_ . -"),
          displayName: z.string().trim().min(1).max(64),
          password: z.string().min(8, "初始密码至少 8 位"),
          role: z.enum(["admin", "operator", "client"]),
          projectId: z.number().int().positive().optional().nullable(),
        }),
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        if (input.role === "client" && !input.projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "客户账号必须绑定项目",
          });
        }
        if (input.projectId) {
          const [p] = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.id, input.projectId))
            .limit(1);
          if (!p) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "绑定项目不存在" });
          }
        }
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, input.username))
          .limit(1);
        if (dup) {
          throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        }
        const [{ id }] = await db
          .insert(users)
          .values({
            username: input.username,
            displayName: input.displayName,
            passwordHash: await hashPassword(input.password),
            role: input.role,
            projectId: input.role === "client" ? input.projectId! : null,
          })
          .$returningId();
        const [u] = await db.select().from(users).where(eq(users.id, id));
        return toSafeUser(u!);
      }),

    /** 停用 / 启用账号；停用时删除其全部会话 */
    setStatus: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          status: z.enum(["active", "disabled"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id && input.status === "disabled") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "不能停用自己的账号",
          });
        }
        const db = getDb();
        const [u] = await db.select().from(users).where(eq(users.id, input.id));
        if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在" });
        await db
          .update(users)
          .set({ status: input.status })
          .where(eq(users.id, input.id));
        if (input.status === "disabled") {
          await db.delete(sessions).where(eq(sessions.userId, input.id));
        }
        return { ok: true };
      }),

    /** 重置密码：重置后删除该账号全部会话，强制重新登录 */
    resetPassword: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          newPassword: z.string().min(8, "新密码至少 8 位"),
        }),
      )
      .mutation(async ({ input }) => {
        const db = getDb();
        const [u] = await db.select().from(users).where(eq(users.id, input.id));
        if (!u) throw new TRPCError({ code: "NOT_FOUND", message: "账号不存在" });
        await db
          .update(users)
          .set({ passwordHash: await hashPassword(input.newPassword) })
          .where(eq(users.id, input.id));
        await db.delete(sessions).where(eq(sessions.userId, input.id));
        return { ok: true };
      }),
  }),
});
