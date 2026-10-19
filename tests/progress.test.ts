import { expect, mock, test } from 'claude-code/testing'

const LIVE = '/home/claude/plan/gov/progress.json'
const A = '01a0c867-d451-724a-a445-4bf9d5a1538f'
const B = '0b0b0b0b-1111-4222-8333-444444444444'
const START = { cwd: '/home/claude', surface: 'desktop', isInteractive: true } as const
const json = (v: unknown) => ({ value: JSON.stringify(v) })
const reply = (status: number, body: unknown) => ({
  value: { status, ok: status >= 200 && status < 300, headers: {}, text: JSON.stringify(body) },
})
const P12 = { pct: 12, stagesDone: 1, stagesTotal: 6 }
const L12 = '▰▱▱▱▱▱▱▱▱▱ 12% · المراحل 1/6'

test('the live file of the same project wins, and the repository is not asked', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_PROJECT_UUID: A })
  const shown: (string | undefined)[] = []
  const fetched: string[] = []
  on('fs.read', ($, e) => (e.path === LIVE ? json({ ...P12, project: A }) : { deny: 'missing' }))
  on('http.fetch', ($, e) => (fetched.push(e.url), reply(200, { pct: 90, stagesDone: 5, stagesTotal: 6 })))
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await clock.advance(2000)

  expect(shown).toEqual([L12])
  expect(fetched).toEqual([])
})

test('each project reads its own file: the installed copy first, then the repository copy', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_PROJECT_UUID: B })
  const shown: (string | undefined)[] = []
  const fetched: string[] = []
  on('fs.read', ($, e) =>
    e.path === LIVE
      ? json({ ...P12, project: A }) // another project's live file: ignored
      : e.path.endsWith(`/progress/${B}.json`)
        ? json({ pct: 40, stagesDone: 2, stagesTotal: 5 })
        : { deny: 'missing' },
  )
  on('http.fetch', ($, e) =>
    (fetched.push(e.url), e.url.endsWith(`/main/progress/${B}.json`) ? reply(200, { pct: 57.6, stagesDone: 3, stagesTotal: 5 }) : reply(404, {})),
  )
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  expect(shown).toEqual(['▰▰▰▰▱▱▱▱▱▱ 40% · المراحل 2/5'])

  await clock.advance(2000)
  expect(fetched.length).toBe(1)
  expect(shown).toEqual(['▰▰▰▰▱▱▱▱▱▱ 40% · المراحل 2/5', '▰▰▰▰▰▰▱▱▱▱ 58% · المراحل 3/5'])
})

test('a failed or broken repository copy keeps what is shown', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_PROJECT_UUID: A })
  const shown: (string | undefined)[] = []
  let calls = 0
  on('fs.read', ($, e) => (e.path.endsWith(`/progress/${A}.json`) ? json(P12) : { deny: 'missing' }))
  on('http.fetch', () => (++calls === 1 ? reply(404, {}) : reply(200, { pct: 'n/a' })))
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await clock.advance(2000)
  await clock.advance(15 * 60 * 1000)

  expect(calls).toBe(2)
  expect(shown).toEqual([L12])
})

test('a project with no file shows no line', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_PROJECT_UUID: B })
  const shown: (string | undefined)[] = []
  on('fs.read', () => ({ deny: 'missing' }))
  on('http.fetch', () => reply(404, {}))
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await clock.advance(2000)

  expect(shown).toEqual([undefined])
})

test('a chat outside any project shows nothing and fetches nothing', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, {})
  const shown: (string | undefined)[] = []
  const fetched: string[] = []
  on('fs.read', () => json(P12))
  on('http.fetch', ($, e) => (fetched.push(e.url), reply(200, P12)))
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await clock.advance(2000)

  expect(shown).toEqual([])
  expect(fetched).toEqual([])
})

test('a project id that is not a plain id is never used in a path or a URL', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { CLAUDE_PROJECT_UUID: '../../etc/passwd' })
  const shown: (string | undefined)[] = []
  const fetched: string[] = []
  on('fs.read', () => json(P12))
  on('http.fetch', ($, e) => (fetched.push(e.url), reply(200, P12)))
  on('ui.status', ($, e) => (shown.push(e.text), { value: undefined }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start(START)
  await clock.advance(2000)

  expect(shown).toEqual([])
  expect(fetched).toEqual([])
})
