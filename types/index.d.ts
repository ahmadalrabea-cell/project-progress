export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Window = { percent: number; resetsAt?: string }
export type Snapshot = {
  model: string
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  fiveHour?: Window
  week?: Window
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'project-progress': {
      snapshot: Snapshot | null
      byModel: Record<string, Tokens>
      isCollapsed: boolean
    }
  }
}
