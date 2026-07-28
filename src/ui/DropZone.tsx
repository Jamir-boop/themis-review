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
    <main className="hero">
      <p className="kicker">{t('drop.kicker')}</p>
      <h1 className="display">
        <span>{t('drop.h1a')}</span>
        <span>{t('drop.h1b')}</span>
        <span>{t('drop.h1c')}</span>
      </h1>
      <p className="hero-hint">{t('drop.hint')}</p>

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
        <div className="dropzone-tabs">
          <span className="dropzone-tab active">{t('drop.tab')}</span>
        </div>
        <div className="dropzone-body">
          <span className="prompt">$</span>
          <span className="dropzone-cmd">{t('drop.title')}</span>
          <button
            className="btn primary"
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
          >
            {t('drop.button')}
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        multiple
        hidden
        onChange={(e) => e.target.files && void handleFiles(e.target.files)}
      />
    </main>
  )
}
