# image-mod

> See the images you paste into Claude Code: thumbnails above the prompt while you write, and the picture under each message you send.

`claude-code` · `mod` · `function-hooks` · `images` · `kitty-graphics`

[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-mod-d97757)](https://github.com/zyx1121/image-mod) &nbsp;[![CI](https://github.com/zyx1121/image-mod/actions/workflows/ci.yml/badge.svg)](https://github.com/zyx1121/image-mod/actions/workflows/ci.yml) &nbsp;[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

Paste a screenshot with ctrl+v and Claude Code shows `[Image #1]`, nothing more. This mod draws the picture itself:

- **Above the prompt**: while the draft holds pasted images, a row of numbered thumbnails.
- **Under sent messages**: each message that carried images shows them below its text.

It is a Claude Code **mod**: a plugin whose behaviour lives in a TypeScript hooks module. No shell hooks, no MCP server, no network.

## Install

Function hooks are early access, so the engine loads a mod only with the flag on. Put it in your shell profile:

```
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
```

Then install it:

```
/plugin marketplace add zyx1121/image-mod
/plugin install image-mod@image-mod
```

Or try it for one session:

```
claude --plugin-dir /path/to/image-mod
```

## Terminals

Pictures need the kitty graphics protocol. Elsewhere the mod draws the `[Image #n]` text in their place.

| Terminal | Works |
| --- | --- |
| Ghostty, kitty | yes |
| Herdr | yes, with `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` (Claude Code reads Herdr as `libghostty`) |
| tmux (in Ghostty or kitty) | yes, with `allow-passthrough on` and `CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1` |
| screen | no: Claude Code turns graphics off inside a multiplexer |

In your shell profile and `~/.tmux.conf`:

```
[[ "${HERDR_ENV:-}" == "1" || -n "${TMUX:-}" ]] && export CLAUDE_CODE_FORCE_TERMINAL_IMAGES=1
set -g allow-passthrough on
```

Inside tmux, Claude Code sends its kitty graphics without the tmux passthrough wrapper, so tmux drops them and every picture stays blank. The mod pipes its own pane (`tmux pipe-pane`) through a small Perl filter that copies each picture command back to the pane wrapped for passthrough. Image ids stay Claude Code's own. The pipe is skipped when the pane already has one.

## How it is built

Claude Code stores every pasted image of a session under `<tmp>/claude-<uid>/<cwd>/<session id>/images/<n>.<ext>`. Pasting raises no event a mod can hook, so the mod looks at that folder every 0.7 seconds, sizes each new image with `sips`, and keeps a PNG copy of any other format under `$TMPDIR/image-mod/`. Typing in the prompt tells it which `[Image #n]` tags are still in the draft; sending the prompt clears the row. macOS only, as it relies on `sips`.

## Contributing

```
bunx -p typescript tsc -p tsconfig.json
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .
```

## License

MIT
