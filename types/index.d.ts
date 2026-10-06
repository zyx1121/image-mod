export type Pasted = { path: string; width: number; height: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'image-mod': { images: Record<string, Pasted>; draft: number[] }
  }
}
