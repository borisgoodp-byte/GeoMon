/**
 * 登录页 /login：品牌深蓝渐变（与侧边栏 #0a2463→#0d2f7d 同系）居中卡片。
 * - 401 → 用户名或密码错误；403 → 账号已停用（错误文案来自后端 message）
 * - 登录成功按角色跳转：client → /projects/{projectId}，其余 → /
 * - 已登录访问 /login 直接按角色跳走
 */
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Loader2, LockKeyhole, UserRound } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const { user, signIn } = useAuth()
  const loginMut = trpc.auth.login.useMutation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 已登录访问 /login：按角色直接跳走
  if (user) {
    const target = user.role === 'client' && user.projectId ? `/projects/${user.projectId}` : '/'
    return <Navigate to={target} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (loginMut.isPending) return
    setError(null)
    try {
      const res = await loginMut.mutateAsync({ username: username.trim(), password })
      signIn(res.token, res.user)
      // 按角色跳转：客户直达绑定项目总览，内部员工回工作台首页
      const target =
        res.user.role === 'client' && res.user.projectId
          ? `/projects/${res.user.projectId}`
          : '/'
      navigate(target, { replace: true })
    } catch (err) {
      // 后端 message：401「用户名或密码错误」/ 403「账号已停用，请联系项目负责人」
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    }
  }

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 80% -10%, rgba(143,179,255,.18) 0%, transparent 60%), linear-gradient(160deg,#0a2463 0%,#0d2f7d 55%,#0a2566 100%)',
      }}
    >
      <div className="w-full max-w-[400px]">
        {/* 品牌区 */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo-geomon.svg" alt="GeoMon" className="h-10 w-auto brightness-0 invert" />
          <p className="mt-3 text-[13px] tracking-wide text-white/60">
            官网 GEO 诊断与监测平台
          </p>
        </div>

        {/* 登录卡片 */}
        <form
          onSubmit={onSubmit}
          className="rounded-xl bg-white p-7 shadow-[0_20px_60px_-15px_rgba(4,16,46,.5)]"
        >
          <h1 className="text-[17px] font-semibold text-[#111827]">登录账号</h1>
          <p className="mt-1 text-caption text-[#6b7280]">请使用管理员分配的账号登录</p>

          <label className="mt-6 block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#374151]">用户名</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                placeholder="请输入用户名"
                className="h-10 w-full rounded-md border border-[#e5e7eb] bg-white pl-9 pr-3 text-small text-[#111827] outline-none transition-shadow placeholder:text-[#9ca3af] focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#374151]">密码</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                placeholder="请输入密码"
                className="h-10 w-full rounded-md border border-[#e5e7eb] bg-white pl-9 pr-3 text-small text-[#111827] outline-none transition-shadow placeholder:text-[#9ca3af] focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </label>

          {/* 错误提示 */}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-caption text-[#b91c1c]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loginMut.isPending}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand text-small font-medium text-white transition-colors hover:bg-[#1648c0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {loginMut.isPending ? '登录中…' : '登 录'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[11px] text-white/40">
          GeoMon · PureblueAI 媒介运营部
        </p>
      </div>
    </div>
  )
}
