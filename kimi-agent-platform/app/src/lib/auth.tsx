/**
 * 认证上下文 + 路由守卫（RBAC 前端核心）。
 * - AuthProvider：内存态 user + localStorage 持久化，刷新不丢登录态
 * - RequireAuth：未登录 → /login
 * - RequireRole：角色不在 allow → 403 提示页
 * - RequireOwnProject：client 访问他人项目路由 → 403 提示页
 * - HomeGate：client 访问工作台首页 → 直达自己项目总览
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { ShieldX } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import {
  clearAuth,
  persistAuth,
  readCachedUser,
  type AuthUser,
  type Role,
} from '@/lib/auth-store'

interface AuthContextValue {
  user: AuthUser | null
  /** 登录成功：写 localStorage + 更新内存态 */
  signIn: (token: string, user: AuthUser) => void
  /** 退出登录：调后端 logout 删除会话，随后清本地并回 /login */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  // 初始值从 localStorage 恢复，保证刷新后仍处于登录态
  const [user, setUser] = useState<AuthUser | null>(() => readCachedUser())
  const logoutMut = trpc.auth.logout.useMutation()

  const signIn = useCallback((token: string, u: AuthUser) => {
    persistAuth(token, u)
    setUser(u)
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logoutMut.mutateAsync()
    } catch {
      // 会话可能已失效（401），忽略错误，照常清理本地态
    }
    clearAuth()
    setUser(null)
    navigate('/login', { replace: true })
  }, [logoutMut, navigate])

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  return ctx
}

/** 登录守卫：未登录访问业务路由 → 跳 /login */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/** 403 提示页：无权访问 + 返回首页 */
export function Forbidden() {
  const { user } = useAuth()
  const home = user?.role === 'client' && user.projectId ? `/projects/${user.projectId}` : '/'
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fef2f2]">
          <ShieldX className="h-6 w-6 text-[#dc2626]" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[#111827]">无权访问该页面</h1>
        <p className="mt-1.5 text-small text-[#6b7280]">
          当前账号没有查看此页面的权限，如有疑问请联系项目负责人。
        </p>
        <Link
          to={home}
          className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-brand px-4 text-small font-medium text-white transition-colors hover:bg-[#1648c0]"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}

/** 角色守卫：角色不在 allow 列表 → 403 提示页 */
export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Forbidden />
  return <>{children}</>
}

/**
 * 项目隔离守卫：client 锁定自己绑定的项目，
 * URL 中 :id 与 user.projectId 不一致 → 403 提示页（后端另有 assertProjectAccess 兜底）。
 */
export function RequireOwnProject({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const params = useParams()
  if (user?.role === 'client') {
    const pid = Number(params.id)
    if (!user.projectId || !Number.isFinite(pid) || pid !== user.projectId) {
      return <Forbidden />
    }
  }
  return <>{children}</>
}

/** 首页分流：client 无工作台首页权限，直达自己项目总览 */
export function HomeGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'client') {
    return user.projectId ? <Navigate to={`/projects/${user.projectId}`} replace /> : <Forbidden />
  }
  return <>{children}</>
}
