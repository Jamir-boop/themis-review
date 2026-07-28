import type { BotScore, Finding, Severity } from './model'

// Tunable weights — single source of truth for scoring.
export const DEDUCTION: Record<Severity, number> = { error: 4, warn: 1.5, info: 0.5 }
/** Max points one rule class can deduct from a single bot — one noisy rule shouldn't nuke the score. */
export const RULE_CAP = 15

/** Variants of one rule (…_LOCAL) share a cap, so splitting a rule in two
 *  changes how findings are weighted without doubling what the category can cost. */
function capGroup(ruleId: string): string {
  return ruleId.replace(/_LOCAL$/, '')
}

export function scoreFindings(findings: Finding[]): number {
  const byRule = new Map<string, number>()
  for (const f of findings) {
    const key = capGroup(f.ruleId)
    byRule.set(key, (byRule.get(key) ?? 0) + DEDUCTION[f.severity])
  }
  let total = 0
  for (const d of byRule.values()) total += Math.min(d, RULE_CAP)
  return Math.max(0, Math.round((100 - total) * 10) / 10)
}

export function grade(score: number): BotScore['grade'] {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function botScore(findings: Finding[]): BotScore {
  const s = scoreFindings(findings)
  return { score: s, grade: grade(s) }
}

/** Project score: line-count weighted average of bot scores. */
export function projectScore(scores: { score: number; lines: number }[]): BotScore {
  const totalLines = scores.reduce((s, x) => s + x.lines, 0)
  const s = totalLines === 0 ? 100 : scores.reduce((s2, x) => s2 + x.score * x.lines, 0) / totalLines
  const rounded = Math.round(s * 10) / 10
  return { score: rounded, grade: grade(rounded) }
}
