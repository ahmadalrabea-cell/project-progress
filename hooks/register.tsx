import type { Register } from 'claude-code'

import { registerProgress } from './progress'
import { registerUsage } from './usage'

// Two parts, one install:
//   progress.ts: the chat's project progress, in the status line under the prompt;
//   usage.tsx:   tokens, the 5-hour and weekly limits, and tokens per model, in a band above the prompt.
export const register: Register = (on, options) => {
  registerProgress(on, options)
  registerUsage(on, options)
}
