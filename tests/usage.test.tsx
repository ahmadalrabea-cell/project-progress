import { expect, mock, test } from 'claude-code/testing'

import { bar, fmt, shortModel, toSnapshot, until } from '../hooks/usage'

test('formatting helpers', async () => {
  expect(fmt(950)).toBe('950')
  expect(fmt(12_400)).toBe('12k')
  expect(fmt(2_300_000)).toBe('2.3M')
  expect(bar(50, 10)).toBe('█████░░░░░')
  expect(shortModel('claude-opus-5-5')).toBe('opus-5-5')
  expect(until('1970-01-01T02:30:00Z', 0)).toBe('2h 30m')
})

test('snapshot picks the 5-hour and weekly windows', async () => {
  const s = toSnapshot('claude-opus-5-5', {
    context: { tokens: 40_000, window: 200_000, percent: 20 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-17T03:00:00Z' },
      { kind: 'seven_day', percentUsed: 41.2 },
    ],
    cost: { usd: 1.25 },
  })
  expect(s.fiveHour?.percent).toBe(23.5)
  expect(s.week?.percent).toBe(41.2)
  expect(s.contextPercent).toBe(20)
})

test('band shows limits and per-model tokens, and collapses', async ($, on) => {
  mock.clock(on)
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  on('turn.step', async function* ($, e) {
    const { model, turnId, index } = e as unknown as { model: string; turnId: string; index: number }
    return { turnId, index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model, input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 20_000, cache_creation_input_tokens: 3000 } } as never
  })
  await $.session.measure({
    context: { tokens: 40_000, window: 200_000, percent: 20 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-17T03:00:00Z' },
      { kind: 'seven_day', percentUsed: 41.2 },
    ],
    cost: { usd: 1.25 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  for (const model of ['claude-opus-5-5', 'claude-haiku-5-5']) {
    for await (const _ of $.turn.step({ model, turnId: 't', index: 0 } as never)) { /* drain */ }
  }
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'project-progress', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false } as never })
    expect(await ui.find({ type: 'Text', text: /5h/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /week/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /haiku-5-5/ })).toBeDefined()
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /haiku-5-5/ })).toBeUndefined()
    await ui.press({ key: 'toggle' })
    await ui.unmount()
  }
})
