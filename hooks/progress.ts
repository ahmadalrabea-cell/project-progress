import type { Register } from 'claude-code'

// The progress of the chat's own claude.ai Project, pinned as this mod's status line under the prompt:
//   ▰▱▱▱▱▱▱▱▱▱ 12% · المراحل 1/6
// One install serves every project: the chat's project (CLAUDE_PROJECT_UUID) picks the file
// progress/<project>.json. A chat outside any project, or in a project with no file, shows no line.
// Sources, first readable one wins:
//   1. LIVE: a file a project's own generator writes in its chat, used only when its "project" matches;
//   2. REMOTE: progress/<project>.json in this mod's GitHub repository, updated weekly;
//   3. the same file as it was when the mod was installed (the installed copy of the repository).
// The local sources are read at session start and after every turn; the remote one shortly after
// session start and every 15 minutes, on a timer, so no turn ever waits on the network.

type Progress = {
  pct: number
  stagesDone: number
  stagesTotal: number
}

const LIVE = '/home/claude/plan/gov/progress.json'
const REPO_RAW = 'https://raw.githubusercontent.com/ahmadalrabea-cell/project-progress/main'
const REMOTE_EVERY_MS = 15 * 60 * 1000
const WIDTH = 10
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const bar = (pct: number): string => {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((pct / 100) * WIDTH)))
  return '▰'.repeat(filled) + '▱'.repeat(WIDTH - filled)
}

const line = (p: Progress): string => {
  const pct = Math.max(0, Math.min(100, Math.round(p.pct)))
  return `${bar(pct)} ${pct}% · المراحل ${p.stagesDone}/${p.stagesTotal}`
}

// `project` given: the file must say it belongs to that project
const parse = (text: string, project?: string): Progress | undefined => {
  try {
    const v = JSON.parse(text) as Partial<Progress> & { project?: unknown }
    if (project !== undefined && v.project !== project) return undefined
    const ok = [v.pct, v.stagesDone, v.stagesTotal].every(n => typeof n === 'number' && Number.isFinite(n))
    return ok ? { pct: v.pct!, stagesDone: v.stagesDone!, stagesTotal: v.stagesTotal! } : undefined
  } catch {
    return undefined
  }
}

const readFile = async (
  read: (path: string) => Promise<string>,
  path: string,
  project?: string,
): Promise<Progress | undefined> => {
  try {
    return parse(await read(path), project)
  } catch {
    return undefined // missing here
  }
}

export const registerProgress: Register = on => {
  let project: string | undefined

  on('session.start', async ($, e, next) => {
    const id = await $.env.get('CLAUDE_PROJECT_UUID')
    project = id !== undefined && PROJECT_ID.test(id) ? id : undefined
    if (!project) return next(e)
    const p = project
    const read = (path: string) => $.fs.read(path)

    const live = await readFile(read, LIVE, p)
    const shown = live ?? (await readFile(read, `${$.plugin.root}/progress/${p}.json`))
    $.ui.status(shown ? line(shown) : undefined)

    const remote = async () => {
      if (await readFile(read, LIVE, p)) return // this chat shows its own live figures
      try {
        const r = await $.http.fetch(`${REPO_RAW}/progress/${p}.json`)
        const fresh = r.ok ? parse(r.text) : undefined
        if (fresh) $.ui.status(line(fresh))
      } catch {
        // offline or refused: keep what is shown
      }
    }
    $.clock.after(1000, () => void remote())
    $.clock.every(REMOTE_EVERY_MS, () => void remote())
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!project) return next(e)
    const live = await readFile(path => $.fs.read(path), LIVE, project)
    if (live) $.ui.status(line(live))
    return next(e)
  })
}
