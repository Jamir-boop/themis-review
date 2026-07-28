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
        <div className="header-zone header-left">
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
        </div>

        <div className="brand">
          <span className="brand-name">Themis</span>
          <span className="brand-name">Review</span>
        </div>

        <div className="header-zone header-right">
          {analysis && (
            <span className="score-badge">
              <span className="score-badge-label">{t('score.project')}</span>
              <span className={'score-badge-value grade-' + analysis.projectScore.grade}>
                {analysis.projectScore.score} · {analysis.projectScore.grade}
              </span>
            </span>
          )}
          {analysis && (
            <button className="btn primary" onClick={exportPdf}>
              {t('header.export')}
            </button>
          )}
          {analysis && (
            <button
              className="btn"
              onClick={() => {
                setAnalysis(null)
                setSelected(null)
                setView('map')
              }}
            >
              {t('header.reset')}
            </button>
          )}
          <button className="btn lang" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
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

const LANG_KEY = 'themis-lang'

function initialLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY)
  if (saved === 'es' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_KEY, l)
    setLangState(l)
  }
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Shell />
    </LangContext.Provider>
  )
}
