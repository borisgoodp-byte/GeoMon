/**
 * 账号管理页 /admin/accounts（仅 admin，路由守卫在 App.tsx）。
 * 功能：用户列表（用户名/姓名/角色/绑定项目/状态/创建时间）
 *      + 新建用户对话框（角色为 client 时必填绑定项目）
 *      + 停用/启用（停用会清除该账号全部会话）
 *      + 重置密码（重置后该账号需重新登录）
 * 所有变更操作后 invalidate 用户列表自动刷新。
 */
import { useState, type FormEvent } from 'react'
import { toast, Toaster } from 'sonner'
import { KeyRound, Loader2, Plus, UserRound } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/lib/auth'
import { ROLE_META, type Role } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** 用户行（后端 auth.users.list 返回，含绑定项目名） */
type UserRow = {
  id: number
  username: string
  displayName: string
  role: Role
  projectId: number | null
  status: 'active' | 'disabled'
  createdAt: string | Date
  projectName: string | null
}

/** 角色徽章（与 Navbar 三色体系一致） */
function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role]
  return (
    <Badge variant="outline" className={meta.badgeClass}>
      {meta.label}
    </Badge>
  )
}

/** 状态徽章 */
function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  return status === 'active' ? (
    <Badge variant="outline" className="border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]">
      启用中
    </Badge>
  ) : (
    <Badge variant="outline" className="border-[#e5e7eb] bg-[#f3f4f6] text-[#6b7280]">
      已停用
    </Badge>
  )
}

/** 新建用户对话框 */
function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const createMut = trpc.auth.users.create.useMutation()
  // 项目下拉数据源（admin 可见全部项目）
  const projectsQ = trpc.projects.list.useQuery()

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [projectId, setProjectId] = useState<string>('')

  function reset() {
    setUsername('')
    setDisplayName('')
    setPassword('')
    setRole('operator')
    setProjectId('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (createMut.isPending) return
    // 前端先拦一道：client 必须绑定项目（后端同样校验）
    if (role === 'client' && !projectId) {
      toast.error('客户账号必须绑定项目')
      return
    }
    try {
      await createMut.mutateAsync({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        role,
        projectId: role === 'client' ? Number(projectId) : null,
      })
      toast.success(`账号「${username.trim()}」创建成功`)
      onOpenChange(false)
      reset()
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>新建用户</DialogTitle>
          <DialogDescription>
            创建平台账号；客户（client）账号必须绑定一个项目，且为只读权限。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cu-username">用户名</Label>
            <Input
              id="cu-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="字母、数字、_ . -，至少 2 位"
              autoComplete="off"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-displayName">姓名</Label>
            <Input
              id="cu-displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="用于界面展示"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">初始密码</Label>
            <Input
              id="cu-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>角色</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">负责人（admin）· 全部权限</SelectItem>
                <SelectItem value="operator">执行（operator）· 业务读写</SelectItem>
                <SelectItem value="client">客户（client）· 仅自己项目只读</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* 角色为 client 时必填绑定项目 */}
          {role === 'client' && (
            <div className="space-y-1.5">
              <Label>
                绑定项目 <span className="text-danger">*</span>
              </Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择客户所属项目" />
                </SelectTrigger>
                <SelectContent>
                  {(projectsQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** 重置密码对话框 */
function ResetPasswordDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: UserRow | null
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const resetMut = trpc.auth.users.resetPassword.useMutation()
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!target || resetMut.isPending) return
    try {
      await resetMut.mutateAsync({ id: target.id, newPassword: password })
      toast.success(`已重置「${target.displayName}」的密码，该账号需重新登录`)
      onOpenChange(false)
      setPassword('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '重置失败')
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>重置密码</DialogTitle>
          <DialogDescription>
            为「{target?.displayName}（{target?.username}）」设置新密码，重置后其全部会话失效。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-password">新密码</Label>
            <Input
              id="rp-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete="new-password"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={resetMut.isPending}>
              {resetMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              确认重置
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Accounts() {
  const { user: me } = useAuth()
  const utils = trpc.useUtils()
  const listQ = trpc.auth.users.list.useQuery()
  const setStatusMut = trpc.auth.users.setStatus.useMutation()

  const [createOpen, setCreateOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)

  /** 操作成功后 invalidate 用户列表，触发自动刷新 */
  const refresh = () => utils.auth.users.list.invalidate()

  /** 停用 / 启用（停用会清除该账号会话，后端禁止停用自己） */
  async function toggleStatus(u: UserRow) {
    const next = u.status === 'active' ? 'disabled' : 'active'
    if (next === 'disabled' && !window.confirm(`确认停用「${u.displayName}」？其登录会话将立即失效。`)) {
      return
    }
    try {
      await setStatusMut.mutateAsync({ id: u.id, status: next })
      toast.success(next === 'disabled' ? `已停用「${u.displayName}」` : `已启用「${u.displayName}」`)
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  const rows = (listQ.data ?? []) as UserRow[]

  return (
    <div className="space-y-5">
      <Toaster richColors position="top-center" />

      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#111827]">账号管理</h1>
          <p className="mt-0.5 text-caption text-[#6b7280]">
            管理平台登录账号与角色权限，共 {rows.length} 个账号
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          新建用户
        </Button>
      </div>

      {/* 用户表 */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>绑定项目</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-[#6b7280]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!listQ.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-[#6b7280]">
                  暂无账号
                </TableCell>
              </TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.id} className={u.status === 'disabled' ? 'opacity-55' : undefined}>
                <TableCell className="font-mono text-[13px]">
                  <span className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 text-[#9ca3af]" />
                    {u.username}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{u.displayName}</TableCell>
                <TableCell>
                  <RoleBadge role={u.role} />
                </TableCell>
                <TableCell className="text-[#6b7280]">{u.projectName ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge status={u.status} />
                </TableCell>
                <TableCell className="font-mono text-caption text-[#6b7280] tabular-nums">
                  {new Date(u.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResetTarget(u)}
                      disabled={u.status === 'disabled'}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      重置密码
                    </Button>
                    {/* 后端禁止停用自己，此处同步隐藏入口 */}
                    {u.id !== me?.id && (
                      <Button
                        variant={u.status === 'active' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => void toggleStatus(u)}
                        disabled={setStatusMut.isPending}
                      >
                        {u.status === 'active' ? '停用' : '启用'}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <ResetPasswordDialog
        target={resetTarget}
        onOpenChange={(v) => !v && setResetTarget(null)}
        onDone={refresh}
      />
    </div>
  )
}
