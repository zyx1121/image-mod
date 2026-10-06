import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pasted } from '../types'

const images = atom({ plugin: 'image-mod', key: 'images' } as const, {})
const draft = atom({ plugin: 'image-mod', key: 'draft' } as const, [])

const PLACEHOLDER = /\[Image #(\d+)\]/g
const STORED = /^(\d+)\.(png|jpe?g|gif|webp)$/
const POLL_MS = 700
const BAND_ROWS = 6
const MESSAGE_ROWS = 12

function numbersIn(text: string): number[] {
  return [...text.matchAll(PLACEHOLDER)].map(m => Number(m[1]))
}

// Terminal cells are about twice as tall as wide; keep the picture's aspect.
function columnsFor(image: Pasted, rows: number, maxColumns: number): number {
  const wide = Math.round((rows * 2 * image.width) / Math.max(1, image.height))
  return Math.max(1, Math.min(255, maxColumns, wide))
}

// Where the engine stores each pasted image of this session:
// <tmp>/claude-<uid>/<cwd, every non-alphanumeric as '-'>/<session id>/images/<n>.<ext>
let uid: string | undefined

async function sessionDirs($: EngineInterface) {
  uid ??= (await $.process.run(['id', '-u'])).stdout.trim()
  const tmp = ((await $.env.get('CLAUDE_CODE_TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  const cwd = (await $.session.cwd()).replace(/[^a-zA-Z0-9]/g, '-')
  const id = await $.session.id()
  const own = ((await $.env.get('TMPDIR')) ?? '/tmp').replace(/\/$/, '')
  return { stored: `${tmp}/claude-${uid}/${cwd}/${id}/images`, cache: `${own}/image-mod/${id}` }
}

const failed = new Set<string>()

// The terminal reads PNG files only; other formats get a PNG copy. sips sizes it.
async function toPng($: EngineInterface, source: string, copy: string, isPng: boolean) {
  let path = source
  if (!isPng) {
    await $.process.run(['mkdir', '-p', copy.slice(0, copy.lastIndexOf('/'))])
    const converted = await $.process.run(['sips', '-s', 'format', 'png', source, '--out', copy], { timeoutMs: 10000 })
    if (converted.exitCode !== 0) return undefined
    path = copy
  }
  const size = await $.process.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path])
  const width = Number(/pixelWidth: (\d+)/.exec(size.stdout)?.[1] ?? 0)
  const height = Number(/pixelHeight: (\d+)/.exec(size.stdout)?.[1] ?? 0)
  return width && height ? { path, width, height } : undefined
}

// Picks up images the engine stored since the last look: one PNG copy each, sized by sips.
async function scan($: EngineInterface) {
  const { stored, cache } = await sessionDirs($)
  if (!(await $.fs.exists(stored))) return

  const known = await read($, images)
  const found: Record<string, Pasted> = {}
  for (const entry of await $.fs.list(stored)) {
    const match = STORED.exec(entry.name)
    const tried = `${stored}/${entry.name}@${entry.mtimeMs}`
    if (!match || known[match[1]!]?.at === entry.mtimeMs || failed.has(tried)) continue

    const image = await toPng($, `${stored}/${entry.name}`, `${cache}/${match[1]}.png`, match[2] === 'png')
    if (image) found[match[1]!] = { ...image, at: entry.mtimeMs }
    else failed.add(tried)
  }

  if (Object.keys(found).length === 0) return
  await update($, images, all => ({ ...all, ...found }))
  // The engine stores an image again when its prompt is sent; only a new number is a paste.
  const pasted = Object.keys(found).filter(n => !known[n]).map(Number)
  if (pasted.length > 0) await update($, draft, now => [...new Set([...now, ...pasted])])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    let busy = false
    $.clock.every(POLL_MS, async () => {
      if (busy) return
      busy = true
      try {
        await scan($)
      } finally {
        busy = false
      }
    })

    return started
  })

  // A paste of an image skips prompt.edit; the next real edit tells which placeholders remain.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    const all = await read($, images)
    const now = numbersIn(box.text).filter(n => all[n])
    await update($, draft, () => now)

    return box
  })

  on('prompt.submit', async ($, e, next) => {
    // Never hold a prompt back over a preview.
    await update($, draft, () => []).catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, draft)
    const all = await read($, images)
    const ready = shown.flatMap(n => (all[n] ? [[n, all[n]] as const] : []))
    if (e.props.hasSurvey || ready.length === 0 || e.surface !== 'terminal') return next(e)

    const { Box, Text, Image } = $.ui.resolve(e)
    // Same shape as the other bands: one cell of padding, an emoji, a space.
    let room = e.props.bodyColumns - 4 - 2 - 3

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" paddingX={1}>
          <Text>📎 </Text>
          <Box flexDirection="row" gap={1}>
            {ready.map(([n, image]) => {
              const columns = columnsFor(image, BAND_ROWS, Math.max(1, room))
              room -= columns + 1
              return room < -1 ? null : (
                <Box key={`b${n}`} flexDirection="column" width={columns}>
                  <Image
                    key={`band-${n}`}
                    source={{ file: image.path, format: 'png', generation: Math.round(image.at) }}
                    columns={columns}
                    rows={BAND_ROWS}
                    alt={`[Image #${n}]`}
                  />
                  <Text dimColor>#{n}</Text>
                </Box>
              )
            })}
          </Box>
        </Box>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const all = await read($, images)
    const ready = numbersIn(e.props.text).flatMap(n => (all[n] ? [[n, all[n]] as const] : []))
    if (ready.length === 0 || e.surface !== 'terminal') return next(e)

    const { Box, Image } = $.ui.resolve(e)
    const maxColumns = Math.max(1, (e.viewport?.columns ?? 80) - 6)

    return (
      <Box flexDirection="column">
        {await next(e)}
        {ready.map(([n, image]) => (
          <Box key={`m${n}`} paddingLeft={2}>
            <Image
              key={`msg-${n}`}
              source={{ file: image.path, format: 'png', generation: Math.round(image.at) }}
              columns={columnsFor(image, MESSAGE_ROWS, maxColumns)}
              rows={MESSAGE_ROWS}
              alt={`[Image #${n}]`}
            />
          </Box>
        ))}
      </Box>
    )
  })
}
