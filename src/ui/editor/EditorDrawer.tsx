import { useMemo, useState } from 'react'
import { isComment, type AAValue, type Action, type Finding, type ProjectAnalysis } from '../../core/model'
import { useT } from '../i18n'
import { typeColor } from '../canvas/nodeTypes'

type Tab = 'code' | 'vars' | 'findings'

/** short human summary of an action's payload for the code listing */
function summarize(a: Action): string {
  const texts: string[] = []
  const walk = (v: AAValue | undefined) => {
    if (v == null || typeof v !== 'object') return
    if (typeof v.expression === 'string' && v.expression) texts.push(v.expression)
    else if (typeof v.string === 'string' && v.string) texts.push(v.string)
    for (const k of Object.keys(v)) {
      const c = (v as Record<string, unknown>)[k]
      if (Array.isArray(c)) c.forEach((x) => walk(x as AAValue))
      else if (c && typeof c === 'object') walk(c as AAValue)
    }
  }
  for (const at of a.attributes) walk(at.value)
  let s = texts.join(' · ')
  // comments store html
  s = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (a.returnTo?.variableName) s += ` → $${a.returnTo.variableName}$`
  return s.length > 120 ? s.slice(0, 117) + '…' : s
}

const SEV_ICON = { error: '🔴', warn: '🟡', info: '🔵' } as const

export default function EditorDrawer({
  analysis,
  botPath,
  onClose,
}: {
  analysis: ProjectAnalysis
  botPath: string
  onClose: () => void
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('code')
  const bot = analysis.taskbots.find((b) => b.path === botPath)
  const findings = useMemo(() => analysis.findings.filter((f) => f.botPath === botPath), [analysis, botPath])
  const byLine = useMemo(() => {
    const m = new Map<number, Finding[]>()
    for (const f of findings) if (f.line) (m.get(f.line) ?? m.set(f.line, []).get(f.line)!).push(f)
    return m
  }, [findings])
  const byVar = useMemo(() => {
    const m = new Map<string, Finding[]>()
    for (const f of findings) if (f.varName) (m.get(f.varName) ?? m.set(f.varName, []).get(f.varName)!).push(f)
    return m
  }, [findings])

  if (!bot) return null
  const metrics = analysis.metrics[botPath]
  const score = analysis.scores[botPath]

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">
            {bot.name} <span className={'tb-grade grade-' + score.grade}>{score.score} · {score.grade}</span>
          </div>
          <div className="drawer-sub">{bot.path}</div>
        </div>
        <button className="btn ghost" onClick={onClose}>
          ✕ {t('editor.close')}
        </button>
      </div>
      <div className="drawer-stats">
        <span>{metrics.totalLines} {t('node.lines')}</span>
        <span>{metrics.commentLines} {t('node.comments')}</span>
        <span>{metrics.logMessages} {t('node.logs')}</span>
        <span>{metrics.variables} {t('node.vars')}</span>
        <span>{t('editor.packages')}: {bot.packages.length}</span>
      </div>
      <nav className="tabs small">
        <button className={tab === 'code' ? 'tab active' : 'tab'} onClick={() => setTab('code')}>
          {t('editor.actions')} ({metrics.totalLines})
        </button>
        <button className={tab === 'vars' ? 'tab active' : 'tab'} onClick={() => setTab('vars')}>
          {t('editor.variables')} ({bot.variables.length})
        </button>
        <button className={tab === 'findings' ? 'tab active' : 'tab'} onClick={() => setTab('findings')}>
          {t('editor.findings')} ({findings.length})
        </button>
      </nav>

      {tab === 'code' && (
        <ol className="code-list">
          {bot.actions.map((a) => {
            const fs = byLine.get(a.line) ?? []
            const cls = [
              'code-line',
              isComment(a) ? 'comment' : '',
              a.disabled || !a.reachable ? 'disabled' : '',
              a.commandName === 'messageBox' ? 'msgbox' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <li key={a.uid} className={cls} style={{ paddingLeft: 8 + a.depth * 18 }}>
                <span className="code-no">{a.line}</span>
                <span className="code-cmd">{a.commandName}</span>
                <span className="code-pkg">{a.packageName}</span>
                <span className="code-sum">{summarize(a)}</span>
                {(a.disabled || !a.reachable) && <span className="code-off">{t('editor.disabled')}</span>}
                {fs.map((f, i) => (
                  <span key={i} className="code-flag" title={t(`rule.${f.ruleId}.msg`, f.params)}>
                    {SEV_ICON[f.severity]}
                  </span>
                ))}
              </li>
            )
          })}
        </ol>
      )}

      {tab === 'vars' && (
        <table className="var-table">
          <thead>
            <tr>
              <th>{t('editor.var.name')}</th>
              <th>{t('editor.var.type')}</th>
              <th>{t('editor.var.io')}</th>
              <th>{t('editor.var.desc')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bot.variables.map((v) => {
              const fs = byVar.get(v.name) ?? []
              return (
                <tr key={v.name} className={fs.length ? 'has-findings' : ''}>
                  <td>
                    <span className="tb-var-dot" style={{ background: typeColor(v.type) }} /> {v.name}
                  </td>
                  <td>{v.type}</td>
                  <td>{v.input && v.output ? 'I/O' : v.input ? 'IN' : v.output ? 'OUT' : v.readOnly ? 'CONST' : '—'}</td>
                  <td className="var-desc">{v.description || '—'}</td>
                  <td>
                    {fs.map((f, i) => (
                      <span key={i} title={t(`rule.${f.ruleId}.msg`, f.params)}>
                        {SEV_ICON[f.severity]}
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {tab === 'findings' && (
        <ul className="finding-list">
          {findings.map((f, i) => (
            <li key={i} className={'finding sev-' + f.severity}>
              <div className="finding-msg">
                {SEV_ICON[f.severity]} {f.line ? `L${f.line} · ` : ''}
                {t(`rule.${f.ruleId}.msg`, f.params)}
              </div>
              <div className="finding-fix">💡 {t(`rule.${f.ruleId}.fix`, f.params)}</div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
