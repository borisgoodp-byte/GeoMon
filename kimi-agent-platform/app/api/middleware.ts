import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

/** 要求已登录（会话有效且账号启用） */
const authed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "未登录或会话已过期" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** client 角色只读：调用任何 mutation 一律 FORBIDDEN */
export const clientGuard = t.middleware(({ ctx, type, next }) => {
  if (ctx.user?.role === "client" && type === "mutation") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "客户账号为只读权限，无法执行写操作",
    });
  }
  return next();
});

/** 内部员工（admin | operator） */
const staffOnly = t.middleware(({ ctx, next }) => {
  if (ctx.user?.role !== "admin" && ctx.user?.role !== "operator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅内部员工可执行该操作" });
  }
  return next();
});

/** 仅 admin（账号管理等） */
const adminOnly = t.middleware(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅项目负责人可执行该操作" });
  }
  return next();
});

/** 已登录即可（业务查询）；clientGuard 兜底拦截 client 的一切 mutation */
export const authedProcedure = t.procedure.use(authed).use(clientGuard);

/** 业务写操作：admin | operator */
export const staffProcedure = authedProcedure.use(staffOnly);

/** 账号管理：仅 admin */
export const adminProcedure = authedProcedure.use(adminOnly);

/**
 * 项目隔离：client 只能访问自己绑定的项目。
 * 所有带 projectId 入参的 procedure 内必须调用；staff 不限制。
 */
export function assertProjectAccess(ctx: TrpcContext, projectId: number) {
  if (ctx.user?.role === "client" && ctx.user.projectId !== projectId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "无权访问该项目的数据",
    });
  }
}
