/**
 * 维度四实测台（9 问录入面板）
 * 依据 references/ai-platform-test.md：3 平台（DeepSeek/豆包/通义千问）× 3 词类（决策词/场景词/对比词）。
 * - 问题由模板生成，可复制、可编辑
 * - 每问记录：命中判定切换 / 回答全文 / 来源清单 / 实测日期（精确到日）
 * - 待实测格子只读，点「录入实测」解锁
 * - 保存 → 服务端自动定档 vis_1/2/3（测满 3 平台才定档，否则待实测）并重算综合分
 * - 禁用词警示条：问题/回答/来源全文扫描「收录/SEO/搜索引擎优化/就绪度」
 * - 底部提醒：实测用无痕窗口，完成后关闭浏览器
 */

import { useEffect, useMemo, useState } from 'react'
import { Check, ClipboardCopy, Loader2, Lock, PencilLine, TriangleAlert } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { cn } from '@/lib/utils'
import {
  VIS_PLATFORM_ORDER,
  VIS_WORD_TYPES,
  VIS_WORD_TYPE_LABELS,
  VIS_INDICATOR_KEYS,
  buildVisTestTemplate,
  visScoresFromTests,
  type VisTest,
  type VisWordType,
} from '@contracts/vistest'
import { PLATFORM_LABELS } from '@contracts/kpi'
import { findBanned, BANNED_REWRITES } from '@contracts/bannedWords'
import { btnPrimary, btnSecondary } from '@/features/diagnosis/meta'
import { useToasts } from '@/features/diagnosis/useToasts'

/** 命中判定三态色 */
const HIT_META = {
  hit: { label: '命中 · 官网被引用', cls: 'border-[#b6ecd8] bg-[#e8faf3] text-[#059669]' },
  miss: { label: '未命中 · 官网零引用', cls: 'border-[#fecaca] bg-[#fef5f5] text-[#b91c1c]' },
  pending: { label: '待实测', cls: 'border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]' },
} as const

interface Props {
  diagnosticId: number
  /** 服务端已留档的 visTests（可能为空） */
  visTests: VisTest[] | null | undefined
  /** 项目名（品牌）/ 行业 / 竞品名（对比词模板用） */
  brand: string
  industry: string
  rival: string
}

export default function VisTestPanel({ diagnosticId, visTests, brand, industry, rival }: Props) {
  const utils = trpc.useUtils()
  const { push } = useToasts()
  const saveMut = trpc.diagnostics.saveVisTests.useMutation()

  const [tests, setTests] = useState<VisTest[]>([])
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({})
  const [dirty, setDirty] = useState(false)
  const [serverBanned, setServerBanned] = useState<string[]>([])

  // 初始化：服务端留档优先，否则按模板生成 9 问
  useEffect(() => {
    if (visTests && visTests.length === 9) {
      setTests(visTests)
      // 已实测的格子默认解锁可读可改；待实测格子保持只读
      const u: Record<string, boolean> = {}
      for (const t of visTests) if (t.hit !== null) u[`${t.platform}:${t.wordType}`] = true
      setUnlocked(u)
      setDirty(false)
    } else if (tests.length === 0) {
      setTests(buildVisTestTemplate({ category: industry, brand, rival }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visTests, brand, industry, rival])

  /** 实时定档预览（词类未测满 3 平台 → 待实测） */
  const preview = useMemo(() => visScoresFromTests(tests), [tests])

  /** 本地禁用词扫描（问题/回答/来源） */
  const localBanned = useMemo(
    () => [...new Set(tests.flatMap((t) => findBanned(`${t.question}\n${t.answer}\n${t.sources}`)))],
    [tests],
  )
  const banned = [...new Set([...localBanned, ...serverBanned])]

  const update = (platform: string, wordType: VisWordType, patch: Partial<VisTest>) => {
    setTests((ts) =>
      ts.map((t) => (t.platform === platform && t.wordType === wordType ? { ...t, ...patch } : t)),
    )
    setDirty(true)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      push('success', '问题已复制，可粘贴到对应 AI 平台实测')
    } catch {
      push('error', '复制失败，请手动选择复制')
    }
  }

  const save = async () => {
    try {
      const r = await saveMut.mutateAsync({ diagnosticId, tests })
      setServerBanned(r.banned)
      setDirty(false)
      const scoreText = VIS_WORD_TYPES.map(
        (wt) => `${VIS_WORD_TYPE_LABELS[wt]} ${r.visScores[VIS_INDICATOR_KEYS[wt]] === null ? '待实测' : `${r.visScores[VIS_INDICATOR_KEYS[wt]]}分`}`,
      ).join('，')
      push('success', `已保存 9 问留档并自动定档：${scoreText}；综合分 ${r.composite.toFixed(1)}（${r.grade} 级）`)
      await utils.diagnostics.get.invalidate({ id: diagnosticId })
    } catch (err) {
      push('error', err instanceof Error ? err.message : '保存失败')
    }
  }

  return (
    <section className="geo-card">
      {/* 卡头 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#f3f4f6] px-5 py-4">
        <span className="h-2.5 w-2.5 rounded-[4px] bg-[#10b981]" />
        <h2 className="text-h2 text-[#111827]">维度四实测台 · 三平台 9 问留档</h2>
        <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-caption text-[#6b7280]">
          测满 3 平台才定档：3/3=20 · 2/3=15 · 1/3=10 · 0/3=0；未测满 → 待实测
        </span>
        <div className="ml-auto flex items-center gap-2">
          {VIS_WORD_TYPES.map((wt) => {
            const s = preview.scores[VIS_INDICATOR_KEYS[wt]]
            const det = preview.detail[wt]
            return (
              <span
                key={wt}
                className={cn(
                  'rounded-full px-2.5 py-1 text-caption font-medium',
                  s === null ? 'bg-[#f3f4f6] text-[#9ca3af]' : 'bg-[#e8faf3] text-[#059669]',
                )}
                title={`${VIS_WORD_TYPE_LABELS[wt]}：命中 ${det.hits}/${det.tested} 平台`}
              >
                {VIS_WORD_TYPE_LABELS[wt]} {s === null ? `待实测（${det.tested}/3）` : `${s} 分`}
              </span>
            )
          })}
        </div>
      </div>

      {/* 禁用词警示条 */}
      {banned.length > 0 && (
        <div className="border-b border-[#fecaca] bg-[#fef5f5] px-5 py-3 text-small text-[#b91c1c]">
          <div className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            检测到禁用词：{banned.join('、')}（对外产出绝不出现「收录 / SEO / 搜索引擎优化 / 就绪度」）
          </div>
          <ul className="mt-1 list-inside list-disc text-caption">
            {banned.map((w) => (
              <li key={w}>
                「{w}」建议转写为「{BANNED_REWRITES[w] ?? BANNED_REWRITES[w.toLowerCase()] ?? '可见 / 被引用'}」
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 9 问录入：按平台分块 */}
      <div className="divide-y divide-[#f3f4f6]">
        {VIS_PLATFORM_ORDER.map((platform) => (
          <div key={platform} className="px-5 py-4">
            <h3 className="mb-3 text-body font-semibold text-[#111827]">{PLATFORM_LABELS[platform]}</h3>
            <div className="space-y-4">
              {VIS_WORD_TYPES.map((wt) => {
                const t = tests.find((x) => x.platform === platform && x.wordType === wt)
                if (!t) return null
                const cellKey = `${platform}:${wt}`
                const isUnlocked = !!unlocked[cellKey]
                const hitMeta = t.hit === null ? HIT_META.pending : t.hit ? HIT_META.hit : HIT_META.miss
                const readonly = t.hit === null && !isUnlocked
                return (
                  <div key={wt} className={cn('rounded-xl border p-4', hitMeta.cls.replace(/text-\S+/, ''))}>
                    {/* 行首：词类 + 问题（可复制可编辑） + 命中切换 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-caption font-semibold text-[#374151] ring-1 ring-[#e5e7eb]">
                        {VIS_WORD_TYPE_LABELS[wt]}
                      </span>
                      <input
                        value={t.question}
                        onChange={(e) => update(platform, wt, { question: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-body outline-none focus:border-brand"
                        placeholder="提问原文（模板生成，可编辑）"
                      />
                      <button
                        type="button"
                        onClick={() => void copy(t.question)}
                        className={cn(btnSecondary, 'h-8 px-2.5 text-caption')}
                        title="复制问题，到对应平台实测"
                      >
                        <ClipboardCopy className="h-3.5 w-3.5" /> 复制
                      </button>
                      {/* 命中切换 */}
                      <div className="flex gap-1">
                        {(
                          [
                            { v: true, label: '命中' },
                            { v: false, label: '未命中' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={String(opt.v)}
                            type="button"
                            disabled={readonly}
                            onClick={() =>
                              update(platform, wt, {
                                hit: t.hit === opt.v ? null : opt.v,
                                testedAt:
                                  t.hit === opt.v
                                    ? null
                                    : (t.testedAt ?? new Date().toISOString().slice(0, 10)),
                              })
                            }
                            className={cn(
                              'h-8 rounded-lg border px-3 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                              t.hit === opt.v
                                ? opt.v
                                  ? 'border-transparent bg-[#059669] text-white'
                                  : 'border-transparent bg-[#dc2626] text-white'
                                : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:bg-[#f9fafb]',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <span className={cn('rounded-full border px-2.5 py-1 text-caption font-medium', hitMeta.cls)}>
                        {hitMeta.label}
                      </span>
                    </div>

                    {readonly ? (
                      /* 待实测只读态 */
                      <button
                        type="button"
                        onClick={() => setUnlocked((u) => ({ ...u, [cellKey]: true }))}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#d1d5db] bg-white/60 px-3 py-2 text-small text-[#9ca3af] transition-colors hover:border-brand hover:text-brand"
                      >
                        <Lock className="h-3.5 w-3.5" /> 待实测 · 点击「录入实测」解锁回答留档
                        <PencilLine className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      /* 实测留档：回答全文 / 来源清单 / 实测日期 */
                      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_150px]">
                        <div>
                          <label className="mb-1 block text-caption text-[#6b7280]">回答全文留档</label>
                          <textarea
                            rows={3}
                            value={t.answer}
                            onChange={(e) => update(platform, wt, { answer: e.target.value })}
                            placeholder="粘贴 AI 平台回答全文（判定：正文给出官网地址/链接，或来源列表包含官网页面；仅提及品牌不计）"
                            className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-small outline-none focus:border-brand"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-caption text-[#6b7280]">来源清单留档</label>
                          <textarea
                            rows={3}
                            value={t.sources}
                            onChange={(e) => update(platform, wt, { sources: e.target.value })}
                            placeholder="粘贴引用来源列表（如「已阅读网页 12 个」「参考 17 篇资料」及来源明细）"
                            className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-small outline-none focus:border-brand"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-caption text-[#6b7280]">实测日期</label>
                          <input
                            type="date"
                            value={t.testedAt ?? ''}
                            onChange={(e) => update(platform, wt, { testedAt: e.target.value || null })}
                            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-small outline-none focus:border-brand"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 底部：保存 + 提醒 */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#f3f4f6] px-5 py-4">
        <button
          type="button"
          className={btnPrimary}
          disabled={saveMut.isPending || tests.length !== 9}
          onClick={() => void save()}
        >
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          保存实测留档并自动定档
        </button>
        {dirty && <span className="text-caption text-[#b45309]">有未保存修改</span>}
        <p className="ml-auto text-caption text-[#9ca3af]">
          提醒：实测请用浏览器无痕窗口逐条提问；保存留档后请关闭浏览器无痕窗口，避免个性化推荐影响下次实测。
        </p>
      </div>
    </section>
  )
}
