import { asText, isTaskbotPath, readZip, type ZipEntry } from './zip'
import { parseTaskbot } from './parse'
import { buildGraph } from './graph'
import { computeMetrics } from './metrics'
import { namingRules } from './rules/naming'
import { messageBoxRules } from './rules/messagebox'
import { structureRules } from './rules/structure'
import { hygieneRules } from './rules/hygiene'
import { botScore, projectScore } from './score'
import type { FileEdge, Finding, OtherFile, ProjectAnalysis, Taskbot, TaskbotMetrics } from './model'

export function analyzeZips(zips: { name: string; data: Uint8Array }[]): ProjectAnalysis {
  const entries: ZipEntry[] = zips.flatMap((z) => readZip(z.name, z.data))

  const taskbots: Taskbot[] = []
  const otherFiles: OtherFile[] = []
  const seenPaths = new Set<string>()

  for (const e of entries) {
    if (e.path === 'manifest.json') continue
    if (isTaskbotPath(e.path)) {
      if (seenPaths.has(e.path)) continue // same bot in several zips: first wins
      try {
        const bot = parseTaskbot(e.path, e.sourceZip, asText(e))
        taskbots.push(bot)
        seenPaths.add(e.path)
        continue
      } catch {
        // extensionless but not a taskbot JSON — fall through to otherFiles
      }
    }
    if (!/\/tasks\/[^/]+Metadata\//.test(e.path)) {
      const kind = /\/docs\/config\//.test(e.path) ? 'config' : /\/docs\/assets\//.test(e.path) ? 'asset' : 'other'
      otherFiles.push({ path: e.path, sourceZip: e.sourceZip, size: e.data.length, kind })
    }
  }

  const metrics: Record<string, TaskbotMetrics> = {}
  const findings: Finding[] = []
  for (const bot of taskbots) {
    const m = computeMetrics(bot)
    metrics[bot.path] = m
    findings.push(...namingRules(bot), ...messageBoxRules(bot), ...structureRules(bot), ...hygieneRules(bot, m))
  }

  const g = buildGraph(taskbots)
  findings.push(...g.findings)

  // taskbot → asset reference: a file is "connected" when its basename appears in
  // any attribute text of the bot. Contents are never analyzed.
  const fileEdges: FileEdge[] = []
  for (const f of otherFiles) {
    const basename = f.path.split('/').pop()!.toLowerCase()
    for (const bot of taskbots) {
      if (bot.textBlob.includes(basename)) fileEdges.push({ from: bot.path, to: f.path })
    }
  }

  const scores: ProjectAnalysis['scores'] = {}
  for (const bot of taskbots) {
    scores[bot.path] = botScore(findings.filter((f) => f.botPath === bot.path))
  }

  return {
    taskbots,
    ghostPaths: g.ghostPaths,
    edges: g.edges,
    fileEdges,
    findings,
    metrics,
    scores,
    projectScore: projectScore(taskbots.map((t) => ({ score: scores[t.path].score, lines: metrics[t.path].totalLines }))),
    otherFiles,
    zipNames: zips.map((z) => z.name),
  }
}
