# project-progress

A status line under the prompt showing the progress of the chat's own claude.ai Project:

```
▰▱▱▱▱▱▱▱▱▱ 12% · المراحل 1/6
```

- **%**: average task completion (done 100%, in progress 25%, otherwise 0).
- **المراحل x/y**: stages whose tasks are all done, out of all stages.

One install serves every project. Each chat shows the figures of the project it belongs to; a chat outside any project, or in a project with no file here, shows no line.

## Adding or updating a project

One file per project: `progress/<project id>.json`, holding four values only:

```json
{ "pct": 12.0, "stagesDone": 1, "stagesTotal": 6, "asOf": "2026-10-18" }
```

The project id is the chat's `CLAUDE_PROJECT_UUID` (Claude in any chat of the project can read it). Chats read the file shortly after they start and every 15 minutes.

## Usage band

A band above the prompt (desktop app and terminal) with the session's usage:

```
🤖 opus-5-5  🧠 ██░░░░░░ 20% (40k/200k)  🔢 24.6k tokens  ⏱ 5h ██░░░░░░ 24% ↻2h 10m  📅 week ███░░░░░ 41% ↻3d 4h  [Less]
by model: opus-5-5 24.5k (in 24k · out 500)   haiku-5-5 300 (in 200 · out 100)
```

- **🧠** how full the context window is; **🔢** tokens this session.
- **⏱ 5h / 📅 week**: the 5-hour and weekly limits (Pro and Max plans, after the first reply), with time to reset. Green, yellow from 70%, red from 90%.
- **by model**: tokens per model that answered, subagents included, counted from when the mod loaded. **Less/More** folds this row.

## Install

At the prompt of a terminal session:

```
/plugin install project-progress --marketplace ahmadalrabea-cell/project-progress
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install project-progress --marketplace ahmadalrabea-cell/project-progress
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `ahmadalrabea-cell/project-progress`, then Add plugin.
