import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeZips } from '../src/core/analyze'
import { RULES, RULE_IDS } from '../src/core/rulesInfo'
import { GRADE_BANDS, grade } from '../src/core/score'
import { translate, type Lang } from '../src/ui/i18n'

const DATA = join(__dirname, '..', '.data')

const analysis = analyzeZips(
  readdirSync(DATA)
    .filter((f) => f.endsWith('.zip'))
    .map((name) => ({ name, data: new Uint8Array(readFileSync(join(DATA, name))) })),
)

describe('rule registry', () => {
  it('registers every rule the engine actually emits', () => {
    const emitted = [...new Set(analysis.findings.map((f) => f.ruleId))].sort()
    const missing = emitted.filter((id) => !RULE_IDS.has(id))
    expect(missing, 'rules fired but absent from rulesInfo.ts').toEqual([])
  })

  it('has no duplicate ids', () => {
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('groups the _LOCAL variant under its parent cap', () => {
    const local = RULES.find((r) => r.id === 'VAR_NO_DESCRIPTION_LOCAL')!
    expect(local.capGroup).toBe('VAR_NO_DESCRIPTION')
  })

  it('agrees with the severity the engine assigns, where the engine is fixed', () => {
    // VAR_NO_DESCRIPTION varies by scope at runtime, so it is excluded here
    for (const r of RULES) {
      if (r.id === 'VAR_NO_DESCRIPTION') continue
      const seen = new Set(analysis.findings.filter((f) => f.ruleId === r.id).map((f) => f.severity))
      if (seen.size > 0) expect([...seen]).toEqual([r.severity])
    }
  })
})

describe('rule texts', () => {
  const langs: Lang[] = ['es', 'en']

  it('has a message and a fix for every registered rule, in both languages', () => {
    const gaps: string[] = []
    for (const r of RULES) {
      for (const lang of langs) {
        for (const kind of ['msg', 'fix']) {
          const key = `rule.${r.id}.${kind}`
          const text = translate(lang, key)
          // translate() echoes the key back when it is missing
          if (text === key || text.trim().length === 0) gaps.push(`${lang}:${key}`)
        }
      }
    }
    expect(gaps).toEqual([])
  })

  it('has a label for every category, in both languages', () => {
    for (const c of new Set(RULES.map((r) => r.category))) {
      for (const lang of langs) {
        const key = `rules.cat.${c}`
        expect(translate(lang, key)).not.toBe(key)
      }
    }
  })
})

describe('grade bands', () => {
  it('matches grade() at every boundary', () => {
    for (const b of GRADE_BANDS) {
      expect(grade(b.min)).toBe(b.grade)
      if (b.min > 0) {
        const below = GRADE_BANDS.find((x) => x.min < b.min)!
        expect(grade(b.min - 0.1)).toBe(below.grade)
      }
    }
  })

  it('is ordered highest first and bottoms out at zero', () => {
    const mins = GRADE_BANDS.map((b) => b.min)
    expect(mins).toEqual([...mins].sort((a, b) => b - a))
    expect(mins[mins.length - 1]).toBe(0)
    expect(grade(0)).toBe('F')
    expect(grade(100)).toBe('A')
  })
})
