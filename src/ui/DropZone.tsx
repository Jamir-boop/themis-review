import { useRef, useState } from 'react'
import { analyzeZips } from '../core/analyze'
import type { ProjectAnalysis } from '../core/model'
import { useT } from './i18n'

export default function DropZone({ onAnalyzed }: { onAnalyzed: (a: ProjectAnalysis) => void }) {
  const t = useT()
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | File[]) => {
    setError(null)
    const zips = await Promise.all(
      [...files]
        .filter((f) => f.name.toLowerCase().endsWith('.zip'))
        .map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })),
    )
    if (zips.length === 0) return
    try {
      const a = analyzeZips(zips)
      if (a.taskbots.length === 0) {
        setError(t('drop.error'))
        return
      }
      onAnalyzed(a)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div
      className={drag ? 'dropzone drag' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        void handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
    >
      <div className="dropzone-icon">⚖️</div>
      <h1>{t('drop.title')}</h1>
      <p>{t('drop.hint')}</p>
      <button className="btn" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
        {t('drop.button')}
      </button>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        hidden
        onChange={(e) => e.target.files && void handleFiles(e.target.files)}
      />
    </div>
  )
}
