/**
 * 认证本地存储与角色元信息（RBAC 前端基座）。
 * 纯工具模块：不依赖 React / tRPC，可被 providers/trpc.tsx 引用（避免循环依赖）。
 */

export type Role = 'admin' | 'operator' | 'client'

/** 当前登录用户（与后端 toSafeUser / TrpcContext['user'] 对齐，绝不含 passwordHash） */
export interface AuthUser {
  id: number
  username: string
  displayName: string
  role: Role
  projectId: number | null
  status: 'active' | 'disabled'
}

const TOKEN_KEY = 'geomon_token'
const USER_KEY = 'geomon_user'

/** 读取本地会话 token（tRPC 请求头注入用） */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** 读取缓存的用户信息（刷新页面时恢复登录态） */
export function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

/** 登录成功：持久化 token + 用户信息 */
export function persistAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

/** 清空本地会话（退出登录 / 收到 401 时调用） */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** 角色元信息：中文称谓 + Navbar 徽章配色（负责人蓝 / 执行绿 / 客户橙） */
export const ROLE_META: Record<
  Role,
  { label: string; badgeClass: string; avatarClass: string }
> = {
  admin: {
    label: '负责人',
    badgeClass: 'border-[#c7d7fe] bg-[#eef2ff] text-[#1a56db]',
    avatarClass: 'bg-brand',
  },
  operator: {
    label: '执行',
    badgeClass: 'border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]',
    avatarClass: 'bg-[#059669]',
  },
  client: {
    label: '客户',
    badgeClass: 'border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]',
    avatarClass: 'bg-[#ea580c]',
  },
}
