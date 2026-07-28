import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeZips } from '../src/core/analyze'

const DATA = join(__dirname, '..', '.data')

function loadAll() {
  return readdirSync(DATA)
    .filter((f) => f.endsWith('.zip'))
    .map((name) => ({ name, data: new Uint8Array(readFileSync(join(DATA, name))) }))
}

function load(name: string) {
  return [{ name, data: new Uint8Array(readFileSync(join(DATA, name))) }]
}

describe('framework zip', () => {
  const a = analyzeZips(load('Framework.zip'))

  it('finds 4 taskbots', () => {
    expect(a.taskbots.map((t) => t.name).sort()).toEqual([
      '000_MasterFrameworkTemplate',
      '001_TareaEjemplo',
      'utilidad_limpiezaGrabaciones',
      'utilidad_mensajeria',
    ])
  })

  it('master calls utilities', () => {
    const master = a.taskbots.find((t) => t.name === '000_MasterFrameworkTemplate')!
    expect(master.calls.length).toBe(6)
    const targets = new Set(master.calls.map((c) => c.targetPath.split('/').pop()))
    expect(targets).toContain('utilidad_mensajeria')
  })

  it('counts comments and metrics on master', () => {
    const m = a.metrics[a.taskbots.find((t) => t.name === '000_MasterFrameworkTemplate')!.path]
    expect(m.commentsByKind['BetterComments']).toBe(19)
    expect(m.totalLines).toBeGreaterThan(50)
  })

  it('flags reachable messageBoxes as MSGBOX_UNATTENDED', () => {
    const mb = a.findings.filter((f) => f.ruleId === 'MSGBOX_UNATTENDED' || f.ruleId === 'MSGBOX_DEAD')
    expect(mb.length).toBeGreaterThan(0)
  })

  it('runTask input wires captured', () => {
    const master = a.taskbots.find((t) => t.name === '000_MasterFrameworkTemplate')!
    const call = master.calls.find((c) => c.targetPath.endsWith('utilidad_mensajeria'))!
    const wire = call.inputs.find((i) => i.calleeVar === 'iDictConfig')!
    expect(wire.callerVars).toContain('pDictConfig')
  })

  it('scores between 0 and 100', () => {
    for (const s of Object.values(a.scores)) {
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
    }
  })
})

describe('all zips combined', () => {
  const a = analyzeZips(loadAll())

  it('parses every taskbot without error', () => {
    expect(a.taskbots.length).toBeGreaterThanOrEqual(20)
  })

  it('builds edges and detects any ghost dependencies consistently', () => {
    for (const e of a.edges) {
      const known = a.taskbots.some((t) => t.path === e.to) || a.ghostPaths.includes(e.to)
      expect(known).toBe(true)
    }
  })

  it('naming rules fire on real data', () => {
    // vStatus-style names exist in legacy bots; at least format or description findings expected
    expect(a.findings.some((f) => f.ruleId.startsWith('VAR_'))).toBe(true)
  })

  it('line numbers are sequential per bot', () => {
    for (const t of a.taskbots) {
      t.actions.forEach((act, i) => expect(act.line).toBe(i + 1))
    }
  })
})
