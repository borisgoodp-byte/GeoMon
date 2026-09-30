import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'

// 路由级代码分割：页面 chunk 按需加载，首屏不再打包 echarts/framer 重组件
const Home = lazy(() => import('@/pages/Home'))
const ProjectOverview = lazy(() => import('@/pages/ProjectOverview'))
const DiagnosisNew = lazy(() => import('@/pages/DiagnosisNew'))
const Scoring = lazy(() => import('@/pages/Scoring'))
const Findings = lazy(() => import('@/pages/Findings'))
const DiagnosisReport = lazy(() => import('@/pages/DiagnosisReport'))
const Quote = lazy(() => import('@/pages/Quote'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Pool = lazy(() => import('@/pages/Pool'))
const Measure = lazy(() => import('@/pages/Measure'))
const Collection = lazy(() => import('@/pages/Collection'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Compete = lazy(() => import('@/pages/Compete'))
const Reports = lazy(() => import('@/pages/Reports'))
const Accounts = lazy(() => import('@/pages/Accounts'))

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>
  )
}
import {
  AuthProvider,
  HomeGate,
  RequireAuth,
  RequireOwnProject,
  RequireRole,
} from '@/lib/auth'

/**
 * 路由契约：Layout 渲染 <Outlet/>（嵌套路由模式）。
 * 报告页 /projects/:id/diagnosis/:dId/report 脱离工作台骨架，独占全屏 Apple 风，不包 Layout。
 *
 * RBAC 守卫：
 * - 全部业务路由包 <RequireAuth>（未登录 → /login）
 * - 内部页面（新建诊断/评分复核/发现与结论/报价/排期/词池/实测/采集）包 <RequireRole allow={['admin','operator']}>
 * - client 可见页（总览/诊断报告/看板/竞对/周期报告）包 <RequireOwnProject>（锁定自己项目）
 * - /admin/accounts 仅 admin；工作台首页经 <HomeGate> 对 client 重定向到其项目总览
 */
export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route
            path="/"
            element={
              <HomeGate>
                <Home />
              </HomeGate>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <RequireOwnProject>
                <ProjectOverview />
              </RequireOwnProject>
            }
          />
          {/* 以下仅内部员工（admin / operator）可见 */}
          <Route
            path="/projects/:id/diagnosis/new"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <DiagnosisNew />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/diagnosis/:dId/scoring"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Scoring />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/diagnosis/:dId/findings"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Findings />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/quote"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Quote />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/schedule"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Schedule />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/pool"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Pool />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/measure"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Measure />
              </RequireRole>
            }
          />
          <Route
            path="/projects/:id/collection"
            element={
              <RequireRole allow={['admin', 'operator']}>
                <Collection />
              </RequireRole>
            }
          />
          {/* client 可见：项目总览 / 诊断报告 / 监测看板 / 竞对对比 / 周期报告 */}
          <Route
            path="/projects/:id/dashboard"
            element={
              <RequireOwnProject>
                <Dashboard />
              </RequireOwnProject>
            }
          />
          <Route
            path="/projects/:id/compete"
            element={
              <RequireOwnProject>
                <Compete />
              </RequireOwnProject>
            }
          />
          <Route
            path="/projects/:id/reports"
            element={
              <RequireOwnProject>
                <Reports />
              </RequireOwnProject>
            }
          />
          {/* 账号管理：仅 admin */}
          <Route
            path="/admin/accounts"
            element={
              <RequireRole allow={['admin']}>
                <Accounts />
              </RequireRole>
            }
          />
        </Route>
        {/* 报告页：无 Layout，独占全屏（client 可见，锁定自己项目） */}
        <Route
          path="/projects/:id/diagnosis/:dId/report"
          element={
            <RequireAuth>
              <RequireOwnProject>
                <DiagnosisReport />
              </RequireOwnProject>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
