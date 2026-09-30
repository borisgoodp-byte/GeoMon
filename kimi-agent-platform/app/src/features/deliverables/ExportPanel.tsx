/**
 * 交付物导出面板（挂在诊断报告页顶栏之后）
 * - trpc.deliverables.status 查缺数置灰（tooltip 列出缺什么）
 * - 四导出：诊断报告 / 评分底稿 / 排期总表 / 报价单 → fetch HTML → Blob 下载
 * - 「打印 / 存为 PDF」：window.open + document.write + print（诊断报告 HTML）
 * - 「客户话术」：五段式话术 Dialog，可编辑 + 一键复制（3 个月版不提指标）
 * - 导出响应带禁用词扫描结果，命中时显示警示条
 */

import { useState } from 'react'
import {
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  FileText,
  CalendarRange,
  BadgeDollarSign,
  Loader2,
  MessageSquareText,
  Printer,
  TriangleAlert,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { cn } from '@/lib/utils'
import { useToasts } from '@/features/diagnosis/useToasts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  projectId: number
  diagnosticId: number
}

/** 导出项定义（kind → 状态键） */
type ExportKind = 'report' | 'workbook' | 'schedule' | 'quote'

const EXPORT_ITEMS: { kind: ExportKind; label: string; icon: typeof FileText; byDiag: boolean }[] = [
  { kind: 'report', label: '诊断报告', icon: FileText, byDiag: true },
  { kind: 'workbook', label: '评分底稿', icon: FileSpreadsheet, byDiag: true },
  { kind: 'schedule', label: '排期总表', icon: CalendarRange, byDiag: false },
  { kind: 'quote', label: '报价单', icon: BadgeDollarSign, byDiag: false },
]

/** HTML 字符串 → Blob 下载 */
function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPanel({ projectId, diagnosticId }: Props) {
  const utils = trpc.useUtils()
  const { push } = useToasts()
  const statusQ = trpc.deliverables.status.useQuery({ projectId })
  const status = statusQ.data

  const [downloading, setDownloading] = useState<ExportKind | 'print' | null>(null)
  const [banned, setBanned] = useState<string[]>([])
  const [scriptOpen, setScriptOpen] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptBanned, setScriptBanned] = useState<string[]>([])

  /** 拉取导出内容（按诊断单或项目） */
  async function fetchExport(kind: ExportKind) {
    if (kind === 'report') return utils.deliverables.exportReport.fetch({ diagnosticId })
    if (kind === 'workbook') return utils.deliverables.exportWorkbook.fetch({ diagnosticId })
    if (kind === 'schedule') return utils.deliverables.exportSchedule.fetch({ projectId })
    return utils.deliverables.exportQuote.fetch({ projectId })
  }

  const onDownload = async (kind: ExportKind) => {
    setDownloading(kind)
    try {
      const r = await fetchExport(kind)
      downloadHtml(r.filename, r.html)
      setBanned(r.banned)
      push('success', `已导出 ${r.filename}`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : '导出失败')
    } finally {
      setDownloading(null)
    }
  }

  /** 打印 / 存为 PDF：打开导出报告 HTML 并调起打印 */
  const onPrint = async () => {
    setDownloading('print')
    try {
      const r = await utils.deliverables.exportReport.fetch({ diagnosticId })
      setBanned(r.banned)
      const win = window.open('', '_blank')
      if (!win) {
        push('error', '浏览器拦截了新窗口，请允许弹窗后重试')
        return
      }
      win.document.write(r.html)
      win.document.close()
      win.onload = () => win.print()
      // 部分浏览器 onload 已触发，兜底延迟调用
      window.setTimeout(() => win.print(), 600)
    } catch (err) {
      push('error', err instanceof Error ? err.message : '生成打印页失败')
    } finally {
      setDownloading(null)
    }
  }

  const openScript = async () => {
    setScriptOpen(true)
    setScriptLoading(true)
    try {
      const r = await utils.deliverables.clientScript.fetch({ diagnosticId })
      setScriptText(r.text)
      setScriptBanned(r.banned)
    } catch (err) {
      push('error', err instanceof Error ? err.message : '生成话术失败')
    } finally {
      setScriptLoading(false)
    }
  }

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptText)
      push('success', '话术已复制')
    } catch {
      push('error', '复制失败，请手动选择复制')
    }
  }

  return (
    <div className="rpt-topbar border-b border-black/[0.06] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-2 px-5 py-2.5">
        <span className="text-[12px] font-medium text-[#6e6e73]">
          交付物导出{status ? `（服务周期 ${status.serviceMonths} 个月）` : ''}：
        </span>
        {EXPORT_ITEMS.map((item) => {
          const st = status?.[item.kind]
          const disabled = !st || !st.ok || downloading !== null
          const Icon = item.icon
          return (
            <button
              key={item.kind}
              type="button"
              disabled={disabled}
              onClick={() => void onDownload(item.kind)}
              title={st && !st.ok ? `缺数据：${st.missing.join('；')}` : `导出《${item.label}》HTML`}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                st && st.ok
                  ? 'border-[#0071e3]/30 bg-[#0071e3]/5 text-[#0071e3] hover:bg-[#0071e3]/10'
                  : 'cursor-not-allowed border-black/[0.08] bg-black/[0.03] text-[#aeaeb2]',
              )}
            >
              {downloading === item.kind ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {item.label}
            </button>
          )
        })}
        <button
          type="button"
          disabled={!status?.report.ok || downloading !== null}
          onClick={() => void onPrint()}
          title={status && !status.report.ok ? `缺数据：${status.report.missing.join('；')}` : '打开诊断报告并调起打印，可存为 PDF'}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-white transition-opacity',
            status?.report.ok ? 'bg-[#0071e3] hover:opacity-90' : 'cursor-not-allowed bg-[#aeaeb2]',
          )}
        >
          {downloading === 'print' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
          打印 / 存为 PDF
        </button>
        <button
          type="button"
          onClick={() => void openScript()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#30d158]/40 bg-[#30d158]/10 px-3 text-[13px] font-medium text-[#1a9e43] transition-colors hover:bg-[#30d158]/20"
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          客户话术
        </button>
        <span className="hidden items-center gap-1 text-[11px] text-[#aeaeb2] md:inline-flex">
          <Download className="h-3 w-3" />
          单文件 HTML · 版式与品牌模板一致
        </span>
      </div>

      {/* 导出物禁用词警示条 */}
      {banned.length > 0 && (
        <div className="border-t border-[#ff3b30]/20 bg-[#ff3b30]/5 px-5 py-2">
          <p className="mx-auto flex max-w-[960px] items-center gap-2 text-[12px] font-medium text-[#b91c1c]">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            最近导出的文件含禁用词：{banned.join('、')}（对外产出绝不出现「收录 / SEO / 搜索引擎优化 / 就绪度」，请修正源数据后重新导出）
          </p>
        </div>
      )}

      {/* 客户话术 Dialog：可编辑 + 复制 */}
      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>五段式客户沟通话术（可编辑）</DialogTitle>
          </DialogHeader>
          {scriptLoading ? (
            <div className="flex items-center gap-2 py-8 text-[#6e6e73]">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在生成话术…
            </div>
          ) : (
            <>
              {scriptBanned.length > 0 && (
                <p className="rounded-lg border border-[#ff3b30]/30 bg-[#ff3b30]/5 px-3 py-2 text-[12px] text-[#b91c1c]">
                  含禁用词：{scriptBanned.join('、')}，请编辑修正后再发送。
                </p>
              )}
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={14}
                className="w-full resize-y rounded-lg border border-black/10 px-3 py-2 text-[14px] leading-relaxed outline-none focus:border-[#0071e3]"
              />
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-[#86868b]">五段式：亮点 → 短板 → 因果 → 套餐周期 → 报价</p>
                <button
                  type="button"
                  onClick={() => void copyScript()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0071e3] px-4 text-[13px] font-medium text-white hover:opacity-90"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  复制话术
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
