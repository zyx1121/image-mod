import { expect, test } from 'claude-code/testing'

test('an image the engine stored shows above the prompt and under the sent message', async ($, on) => {
  on('env.get', () => ({ value: undefined }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  on('session.cwd', () => ({ value: '/w/p' }) as never)
  on('fs.exists', () => ({ value: true }) as never)
  on('fs.list', () => ({ value: [{ name: '1.png', kind: 'file', size: 9, mtimeMs: 5, isLink: false }] }) as never)
  on('process.run', ($, e) => {
    const stdout = e.argv[0] === 'id' ? '501\n' : e.argv[0] === 'sips' ? '  pixelWidth: 800\n  pixelHeight: 400\n' : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  let ticks = 0
  on('clock.every', () => (ticks++ < 1 ? { value: undefined } : { deny: 'test over' }) as never)
  on('session.start', ($, e) => ({ cwd: '/w/p' }) as never)
  on('prompt.edit', ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine band</Text>
  })
  on('ui.render', { component: 'UserMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })

  // @ts-expect-error the test kit raises session.start; EngineNoun<'session'> does not type it
  await $.session.start({ source: 'startup', cwd: '/w/p' })
  for (let i = 0; i < 50 && ticks < 2; i++) await Promise.resolve()

  const band = await $.ui.mount({
    plugin: 'image-mod',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { bodyColumns: 100, hasSurvey: false } as never,
  })
  expect(await band.findAll({ type: 'Image' })).toHaveLength(1)

  const message = await $.ui.mount({
    plugin: 'image-mod',
    surface: 'terminal',
    component: 'UserMessage',
    props: { text: 'look [Image #1]', origin: { kind: 'composer' }, isExpanded: false } as never,
  })
  expect(await message.findAll({ type: 'Image' })).toHaveLength(1)
})
