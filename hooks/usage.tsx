import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit, SessionUsage } from 'claude-code'

import type { Snapshot, Tokens, Window } from '../types'

const snapshot = atom({ plugin: 'project-progress', key: 'snapshot' } as const, null)
const byModel = atom({ plugin: 'project-progress', key: 'byModel' } as const, {})
const isCollapsed = atom({ plugin: 'project-progress', key: 'isCollapsed' } as const, false)

export function fmt(n: number | undefined): string {
  if (n === undefined) return '—'
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

export function bar(percent: number | undefined, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(percent ?? 0)))
  const filled = Math.round((p * width) / 100)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function tone(percent: number | undefined): 'success' | 'warning' | 'error' {
  const p = percent ?? 0
  return p >= 90 ? 'error' : p >= 70 ? 'warning' : 'success'
}

export function until(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ''
  let s = Math.max(0, Math.floor((Date.parse(resetsAt) - now) / 1000))
  const d = Math.floor(s / 86400)
  s %= 86400
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}

export function shortModel(id: string): string {
  return id.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

export function total(t: Tokens): number {
  return t.input + t.output + t.cacheRead + t.cacheWrite
}

function windowOf(limits: SessionRateLimit[], kind: string): Window | undefined {
  const w = limits.find(l => l.kind === kind)
  return w ? { percent: w.percentUsed, resetsAt: w.resetsAt } : undefined
}

export function toSnapshot(model: string, u: Omit<SessionUsage, 'startedAt'>): Snapshot {
  return {
    model,
    contextTokens: u.context.tokens,
    contextWindow: u.context.window,
    contextPercent: u.context.percent,
    fiveHour: windowOf(u.rateLimits, 'five_hour'),
    week: windowOf(u.rateLimits, 'seven_day'),
    costUsd: u.cost?.usd,
  }
}

export const registerUsage: Register = on => {
  on('session.measure', async ($, e, next) => {
    const model = await $.session.model()
    await update($, snapshot, () => toSnapshot(model, e))
    return next(e)
  })

  // Every model response, main thread and subagents: add its tokens to the model that answered.
  on('turn.step', async function* ($, e, next) {
    const response = yield* next(e)
    const u = response.usage
    if (u) {
      const key = shortModel(u.model)
      await update($, byModel, prev => {
        const t = prev[key] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
        return {
          ...prev,
          [key]: {
            input: t.input + u.input_tokens,
            output: t.output + u.output_tokens,
            cacheRead: t.cacheRead + u.cache_read_input_tokens,
            cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
          },
        }
      })
    }
    return response
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // first draw of the session: read the figures now (session.start is the progress part's)
    let s = await read($, snapshot)
    if (s === null) {
      const [model, usage] = await Promise.all([$.session.model(), $.session.usage()])
      s = toSnapshot(model, usage)
      await update($, snapshot, () => s)
    }
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const models = await read($, byModel)
    const collapsed = await read($, isCollapsed)
    const now = await $.clock.now()

    const rows = Object.entries(models).sort((a, b) => total(b[1]) - total(a[1]))
    const sum = rows.reduce((acc, [, t]) => acc + total(t), 0)

    const toggle = (
      <Button
        key="toggle"
        label={collapsed ? 'More' : 'Less'}
        onPress={() => update($, isCollapsed, v => !v)}
      />
    )

    const limit = (label: string, w: Window | undefined) =>
      w ? (
        <Text>
          {label} <Text color={tone(w.percent)}>{bar(w.percent, 8)}</Text> {Math.round(w.percent)}%
          <Text dimColor> ↻{until(w.resetsAt, now)}</Text>
        </Text>
      ) : (
        <Text dimColor>{label} —</Text>
      )

    const line1 = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text color="claude" weight="bold">🤖 {shortModel(s.model)}</Text>
        <Text>
          🧠 <Text color={tone(s.contextPercent)}>{bar(s.contextPercent, 8)}</Text>{' '}
          {s.contextPercent ?? 0}% <Text dimColor>({fmt(s.contextTokens)}/{fmt(s.contextWindow)})</Text>
        </Text>
        <Text>🔢 {fmt(sum)} tokens</Text>
        {limit('⏱ 5h', s.fiveHour)}
        {limit('📅 week', s.week)}
        {s.costUsd !== undefined ? <Text dimColor>${s.costUsd.toFixed(2)}</Text> : null}
        {toggle}
      </Box>
    )

    if (collapsed || rows.length === 0) return <Box flexDirection="column">{line1}</Box>

    return (
      <Box flexDirection="column">
        {line1}
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text dimColor>by model:</Text>
          {rows.map(([name, t]) => (
            <Text key={name}>
              {name} <Text weight="bold">{fmt(total(t))}</Text>
              <Text dimColor>
                {' '}(in {fmt(t.input + t.cacheRead + t.cacheWrite)} · out {fmt(t.output)})
              </Text>
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
