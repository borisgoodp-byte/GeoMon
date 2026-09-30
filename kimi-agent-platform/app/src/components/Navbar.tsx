import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ChevronRight, Clock3, LogOut } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { dayToDate } from '@contracts/schedule'
import { useAuth } from '@/lib/auth'
import { ROLE_META } from '@/lib/auth-store'

/** 顶栏 56px：Logo区 / 面包屑 / 用户区（normal flow，sticky 由 Layout 控制） */
export default function Navbar() {
  const location = useLocation()
  const params = useParams()
  const { user, signOut } = useAuth()
  const listQ = trpc.projects.list.useQuery()

  // 当前项目上下文（路由 :id 优先，否则回退第一个项目）
  const ctxProject = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    const rows = listQ.data ?? []
    if (parts[0] === 'projects' && parts[1]) {
      return rows.find((p) => String(p.id) === parts[1] || p.domain === parts[1]) ?? rows[0]
    }
    return rows[0]
  }, [location.pathname, listQ.data])

  const scheduleQ = trpc.schedules.get.useQuery(
    { projectId: ctxProject?.id ?? 0 },
    { enabled: !!ctxProject },
  )

  // 距下一考核节点天数（m6 未过则 m6，否则 m12；无排期则隐藏）
  const checkpoint = useMemo(() => {
    const s = scheduleQ.data
    if (!s) return null
    const miles = (s.milestonesJson ?? []) as { name: string; day: number }[]
    const today = new Date()
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    for (const key of ['6 个月考核', '12 个月考核']) {
      const m = miles.find((x) => x.name === key)
      if (!m) continue
      const date = dayToDate(s.startDate, m.day)
      const remain = Math.round((new Date(`${date}T00:00:00Z`).getTime() - todayUTC) / 86_400_000)
      if (remain >= 0) return { label: key.replace('考核', '考核节点'), remain }
    }
    return null
  }, [scheduleQ.data])

  const breadcrumb = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    const crumbs: { label: string; to?: string }[] = [{ label: '工作台', to: '/' }]
    if (parts[0] === 'projects' && parts[1]) {
      const rows = listQ.data ?? []
      const project = rows.find(
        (p) => String(p.id) === parts[1] || p.domain === parts[1],
      )
      crumbs.push({
        label: project ? project.name : parts[1],
        to: `/projects/${parts[1]}`,
      })
      const sectionMap: Record<string, string> = {
        diagnosis: '诊断',
        quote: '报价单',
        schedule: '排期表',
        pool: '词池管理',
        measure: '实测录入',
        collection: '采集中心',
        dashboard: '监测看板',
        compete: '竞对对比',
        reports: '周期报告',
      }
      if (parts[2] && sectionMap[parts[2]]) {
        crumbs.push({ label: sectionMap[parts[2]] })
        if (parts[2] === 'diagnosis') {
          if (parts[3] === 'new') crumbs.push({ label: '新建诊断' })
          else if (parts[4]) {
            const sub: Record<string, string> = {
              scoring: '评分复核',
              findings: '发现与结论',
              report: '诊断报告',
            }
            if (sub[parts[4]]) crumbs.push({ label: sub[parts[4]] })
          }
        }
      }
    } else if (parts[0] === 'admin' && parts[1] === 'accounts') {
      crumbs.push({ label: '账号管理' })
    }
    // 去掉末级链接（当前页不可点）
    if (crumbs.length > 1) delete crumbs[crumbs.length - 1].to
    void params
    return crumbs
  }, [location.pathname, params, listQ.data])

  const today = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e5e7eb] bg-white px-5">
      {/* Logo 区（移动端/窄屏可见；桌面端 Logo 在 Sidebar） */}
      <Link to="/" className="mr-4 flex items-center lg:hidden" aria-label="GeoMon 首页">
        <img src="/logo-geomon.svg" alt="GeoMon" className="h-8 w-auto" />
      </Link>

      {/* 面包屑 */}
      <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1 text-small">
        {breadcrumb.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />}
            {c.to ? (
              <Link to={c.to} className="truncate text-[#6b7280] transition-colors hover:text-brand">
                {c.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-[#111827]">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* 用户区 */}
      <div className="ml-4 flex shrink-0 items-center gap-4">
        <span className="hidden font-mono text-caption text-[#6b7280] tabular-nums md:inline">
          {today}
        </span>
        {checkpoint && (
          <span className="hidden items-center gap-1.5 rounded-full border border-[#fde9c8] bg-[#fff8ec] px-2.5 py-1 text-caption text-[#b45309] md:flex">
            <Clock3 className="h-3 w-3" />
            距 {checkpoint.label} <span className="tabular-nums">{checkpoint.remain}</span> 天
          </span>
        )}
        {/* 当前用户 chip：头像 + 姓名 + 角色徽章 + 退出 */}
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white ${ROLE_META[user.role].avatarClass}`}
              >
                {user.displayName.slice(0, 1)}
              </span>
              <span className="hidden text-small text-[#374151] sm:inline">
                {user.displayName}
              </span>
              <span
                className={`hidden rounded-full border px-2 py-0.5 text-caption font-medium sm:inline ${ROLE_META[user.role].badgeClass}`}
              >
                {ROLE_META[user.role].label}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              title="退出登录"
              aria-label="退出登录"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition-colors hover:bg-[#f3f4f6] hover:text-[#111827]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
