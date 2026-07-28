import { useContext, useState } from 'react'
import type { ProjectAnalysis } from '../core/model'
import { LangContext, useT, type Lang } from './i18n'
import DropZone from './DropZone'
import Canvas from './canvas/Canvas'
import EditorDrawer from './editor/EditorDrawer'
import Report from './report/Report'

type View = 'map' | 'report'

function Shell() {
  const t = useT()
  const { lang, setLang } = useContext(LangContext)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [view, setView] = useState<View>('map')
  const [selected, setSelected] = useState<string | null>(null)

  const exportPdf = () => {
    setView('report')
    setSelected(null)
    setTimeout(() => window.print(), 100)
  }

  return (
    <div className="app">
      <header className="header no-print">
        <div className="brand">
          <span className="brand-name">Themis Review</span>
          <span className="brand-tag">{t('app.tagline')}</span>
        </div>
        {analysis && (
          <nav className="tabs">
            <button className={view === 'map' ? 'tab active' : 'tab'} onClick={() => setView('map')}>
              {t('tab.map')}
            </button>
            <button className={view === 'report' ? 'tab active' : 'tab'} onClick={() => setView('report')}>
              {t('tab.report')}
            </button>
          </nav>
        )}
        <div className="header-right">
          {analysis && (
            <span className={'score-badge grade-' + analysis.projectScore.grade}>
              {analysis.projectScore.score} · {analysis.projectScore.grade}
            </span>
          )}
          {analysis && (
            <button className="btn" onClick={exportPdf}>
              {t('header.export')}
            </button>
          )}
          {analysis && (
            <button
              className="btn ghost"
              onClick={() => {
                setAnalysis(null)
                setSelected(null)
                setView('map')
              }}
            >
              {t('header.reset')}
            </button>
          )}
          <button className="btn ghost lang" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
        </div>
      </header>

      {!analysis && <DropZone onAnalyzed={setAnalysis} />}
      {analysis && view === 'map' && (
        <div className="canvas-wrap no-print">
          <Canvas analysis={analysis} onSelect={setSelected} />
          {selected && <EditorDrawer analysis={analysis} botPath={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
      {analysis && view === 'report' && <Report analysis={analysis} />}
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('es')
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Shell />
    </LangContext.Provider>
  )
}
