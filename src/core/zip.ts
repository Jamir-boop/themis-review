import { unzipSync } from 'fflate'

export interface ZipEntry {
  path: string // forward-slash, no leading slash
  data: Uint8Array
  sourceZip: string
}

/** Unzip one archive to file entries (directories skipped). */
export function readZip(name: string, bytes: Uint8Array): ZipEntry[] {
  const files = unzipSync(bytes)
  return Object.entries(files)
    .filter(([p, d]) => !p.endsWith('/') && d.length > 0)
    .map(([p, data]) => ({ path: p.replace(/\\/g, '/'), data, sourceZip: name }))
}

const decoder = new TextDecoder('utf-8')

export function asText(e: ZipEntry): string {
  return decoder.decode(e.data)
}

/** Taskbot source files live under .../tasks/<Name> with no extension; Metadata dirs hold pngs. */
export function isTaskbotPath(path: string): boolean {
  const parts = path.split('/')
  const i = parts.indexOf('tasks')
  return i >= 0 && i === parts.length - 2 && !parts[parts.length - 1].includes('.')
}
