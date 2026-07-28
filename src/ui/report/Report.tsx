import type { ProjectAnalysis, Severity } from '../../core/model'
import { useT } from '../i18n'

const SEV_ORDER: Record<Severity, number> = { error: 0, warn: 1, info: 2 }
const SEV_ICON = { error: '🔴', warn: '🟡', info: '🔵' } as const

export default function Report({ analysis }: { analysis: ProjectAnalysis }) {
  const t = useT()
  const date = new Date().toISOString().slice(0, 10)

  return (
    <div className="report">
      <header className="report-head">
        <h1>{t('report.title')}</h1>
        <div className={'report-score grade-' + analysis.projectScore.grade}>
          <span className="report-score-num">{analysis.projectScore.score}</span>
          <span className="report-score-grade">{analysis.projectScore.grade}</span>
        </div>
      </header>
      <p className="report-meta">
        {t('report.date')}: {date} · {t('report.files')}: {analysis.zipNames.join(', ')}
      </p>

      <h2>{t('report.summary')}</h2>
      <table className="report-table">
        <thead>
          <tr>
            <th>{t('report.taskbot')}</th>
            <th>{t('node.lines')}</th>
            <th>{t('node.comments')}</th>
            <th>{t('node.logs')}</th>
            <th>{t('node.vars')}</th>
            <th>{t('report.findings')}</th>
            <th>{t('report.score')}</th>
          </tr>
        </thead>
        <tbody>
          {analysis.taskbots.map((b) => {
            const m = analysis.metrics[b.path]
            const s = analysis.scores[b.path]
            const n = analysis.findings.filter((f) => f.botPath === b.path).length
            return (
              <tr key={b.path}>
                <td>{b.name}</td>
                <td>{m.totalLines}</td>
                <td>{m.commentLines}</td>
                <td>{m.logMessages}</td>
                <td>{m.variables}</td>
                <td>{n}</td>
                <td className={'grade-' + s.grade}>
                  {s.score} · {s.grade}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {analysis.taskbots.map((b) => {
        const fs = analysis.findings
          .filter((f) => f.botPath === b.path)
          .sort((x, y) => SEV_ORDER[x.severity] - SEV_ORDER[y.severity] || (x.line ?? 0) - (y.line ?? 0))
        return (
          <section key={b.path} className="report-bot">
            <h2>
              {b.name}{' '}
              <span className={'tb-grade grade-' + analysis.scores[b.path].grade}>
                {analysis.scores[b.path].score} · {analysis.scores[b.path].grade}
              </span>
            </h2>
            <p className="report-bot-path">{b.path}</p>
            {fs.length === 0 && <p>{t('report.noFindings')}✅</p>}
            {fs.map((f, i) => (
              <div key={i} className={'report-finding sev-' + f.severity}>
                <div className="finding-msg">
                  {SEV_ICON[f.severity]} <strong>{t('report.severity.' + f.severity)}</strong>
                  {f.line ? ` · ${t('report.finding.line')} ${f.line}` : ''} · <code>{f.ruleId}</code>
                  <br />
                  {t(`rule.${f.ruleId}.msg`, f.params)}
                </div>
                <div className="finding-fix">
                  <strong>{t('report.finding.fix')}:</strong> {t(`rule.${f.ruleId}.fix`, f.params)}
                </div>
              </div>
            ))}
          </section>
        )
      })}
      <footer className="report-foot">
        {t('report.generatedBy')} · {date}
      </footer>
    </div>
  )
}
