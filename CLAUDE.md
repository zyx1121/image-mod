# image-mod

A Claude Code mod (function-hooks plugin): `hooks/register.tsx` exports `register(on, options)`. It polls the folder where the engine stores pasted images (`<tmp>/claude-<uid>/<cwd>/<session id>/images/`), sizes each with `sips` (converting non-PNG to a PNG copy), and draws `Image` elements in the `AbovePrompt` band and under `UserMessage` rows.

- Typecheck: `bunx -p typescript tsc -p tsconfig.json` (no node_modules; `types/claude-code.d.ts` is the engine contract written by Claude Code's plugin-authoring skill).
- Tests: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .`
- Run from source: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .`
- Pasting an image raises no `prompt.edit`; the folder poll is what notices it. The engine stores an image again when its prompt is sent, so only a new number counts as a paste.
- Inside tmux the engine turns kitty graphics off; `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` turns them on, but the engine still sends them without the `\ePtmux;` wrapper, so tmux drops them. `rewrapInTmux` pipes the pane through a Perl filter that sends each one back wrapped. Plugins cannot draw U+10EEEE placeholders themselves: the engine rejects that text.
- Function hooks are early access; when the engine's contract changes, refresh `types/claude-code.d.ts` and re-run both checks.
- GitHub-facing text is English. No em dashes.
