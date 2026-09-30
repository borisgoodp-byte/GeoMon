import { useMemo } from 'react'
import { NavLink, Outlet, useParams } from 'react-router'
import {
  LayoutDashboard,
  FolderKanban,
  FileSearch,
  ClipboardCheck,
  ListChecks,
  FileText,
  ReceiptText,
  CalendarRange,
  Database,
  Keyboard,
  Radar,
  LineChart,
  Swords,
  Files,
  Users,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { cn } from '@/lib/utils'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/lib/auth'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  /** 精确匹配（默认前缀匹配） */
  exact?: boolean
  /** client（客户）角色可见；缺省仅内部员工可见 */
  clientVisible?: boolean
}

/** 工作台首页仅内部员工可见；client 登录后直达自己的项目总览 */
const GLOBAL_NAV: NavItem[] = [
  { label: '工作台首页', to: '/', icon: LayoutDashboard, exact: true },
]

/** 系统管理入口：仅 admin（项目负责人） */
const ADMIN_NAV: NavItem[] = [
  { label: '用户', to: '/admin/accounts', icon: Users },
]

/** 当前项目导航：由路由 :id 驱动；不在项目路由时回退到最近一个项目（client 锁定自己项目） */
function useProjectNav(role: string | undefined): { items: NavItem[]; projectName?: string } {
  const params = useParams()
  const listQ = trpc.projects.list.useQuery()
  return useMemo(() => {
    const rows = listQ.data ?? []
    const ctx =
      (params.id && rows.find((p) => String(p.id) === params.id)) || rows[0]
    if (!ctx) return { items: [] }
    const pid = ctx.id
    const dId = ctx.latestDiagnostic?.id
    const items: NavItem[] = [
      { label: '项目总览', to: `/projects/${pid}`, icon: FolderKanban, exact: true, clientVisible: true },
      { label: '新建诊断', to: `/projects/${pid}/diagnosis/new`, icon: FileSearch },
      {
        label: '评分复核',
        to: dId ? `/projects/${pid}/diagnosis/${dId}/scoring` : `/projects/${pid}/diagnosis/new`,
        icon: ClipboardCheck,
      },
      {
        label: '发现与结论',
        to: dId ? `/projects/${pid}/diagnosis/${dId}/findings` : `/projects/${pid}/diagnosis/new`,
        icon: ListChecks,
      },
      {
        label: '诊断报告',
        to: dId ? `/projects/${pid}/diagnosis/${dId}/report` : `/projects/${pid}/diagnosis/new`,
        icon: FileText,
        clientVisible: true,
      },
      { label: '报价单', to: `/projects/${pid}/quote`, icon: ReceiptText },
      { label: '排期表', to: `/projects/${pid}/schedule`, icon: CalendarRange },
      { label: '词池管理', to: `/projects/${pid}/pool`, icon: Database },
      { label: '实测录入', to: `/projects/${pid}/measure`, icon: Keyboard },
      { label: '采集中心', to: `/projects/${pid}/collection`, icon: Radar },
      { label: '监测看板', to: `/projects/${pid}/dashboard`, icon: LineChart, clientVisible: true },
      { label: '竞对对比', to: `/projects/${pid}/compete`, icon: Swords, clientVisible: true },
      { label: '周期报告', to: `/projects/${pid}/reports`, icon: Files, clientVisible: true },
    ]
    // 按角色过滤：client 仅见 总览/诊断报告/监测看板/竞对对比/周期报告
    const visible = role === 'client' ? items.filter((i) => i.clientVisible) : items
    return { items: visible, projectName: ctx.name }
  }, [listQ.data, params.id, role])
}

function SideNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-white/85 transition-colors duration-150 ease-geo',
          'hover:bg-white/[.13] hover:text-white',
          isActive && 'bg-white/[.16] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]',
        )
      }
      title={item.label}
    >
      {({ isActive }) => (
        <>
          {/* 激活态左 3px 亮蓝条 */}
          <span
            className={cn(
              'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[#8fb3ff] transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <item.icon className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate xl:inline md:hidden">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * 工作台骨架：左侧 220px 深色 Sidebar + 顶栏 56px + 内容槽。
 * 内容槽采用 <Outlet/>（嵌套路由模式）——App.tsx 必须以
 * <Route element={<Layout/>}> 包裹子路由，禁止混用 children 模式。
 */
export default function Layout() {
  const { user } = useAuth()
  const role = user?.role
  const { items: projectNav, projectName } = useProjectNav(role)
  return (
    <div className="flex min-h-[100dvh] bg-page">
      {/* Sidebar：深色渐变，≥1280px 展开 220px，768–1280px 折叠 64px 图标栏 */}
      <aside
        className="sticky top-0 hidden h-[100dvh] w-[220px] shrink-0 flex-col md:flex md:w-16 xl:w-[220px]"
        style={{
          background: 'linear-gradient(180deg,#0a2463 0%,#0d2f7d 55%,#0a2566 100%)',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,.06)',
        }}
      >
        {/* Logo 块 */}
        <NavLink to="/" className="flex h-14 shrink-0 items-center border-b border-white/10 px-4">
          <img
            src="/logo-geomon.svg"
            alt="GeoMon"
            className="h-8 w-auto brightness-0 invert xl:inline md:hidden"
          />
          <span className="hidden text-[15px] font-bold text-white md:inline xl:hidden">G</span>
        </NavLink>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
          {/* 全局区：client 无工作台首页，整块隐藏 */}
          {role !== 'client' && (
            <div>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 xl:inline md:hidden">
                全局
              </p>
              <div className="space-y-0.5">
                {GLOBAL_NAV.map((item) => (
                  <SideNavLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          )}
          {projectNav.length > 0 && (
            <div>
              <p className="mb-1.5 truncate px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 xl:inline md:hidden">
                {role === 'client' ? '我的项目' : '当前项目'}
                {projectName ? ` · ${projectName}` : ''}
              </p>
              <div className="space-y-0.5">
                {projectNav.map((item) => (
                  <SideNavLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          )}
          {/* 系统管理：仅 admin 可见 */}
          {role === 'admin' && (
            <div>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55 xl:inline md:hidden">
                系统
              </p>
              <div className="space-y-0.5">
                {ADMIN_NAV.map((item) => (
                  <SideNavLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* 底部署名 */}
        <div className="shrink-0 border-t border-white/[.12] p-4 xl:block md:hidden">
          <img src="/logo-pureblue.svg" alt="PureblueAI 媒介运营部" className="h-5 w-auto" />
          <p className="mt-2 font-mono text-[11px] text-white/50 tabular-nums">GeoMon v1.0</p>
        </div>
      </aside>

      {/* 右侧：顶栏 + 内容槽 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40">
          <Navbar />
        </div>
        <main className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-[1280px] flex-1 p-6">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  )
}
