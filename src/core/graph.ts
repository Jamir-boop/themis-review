import type { Finding, GraphEdge, Taskbot } from './model'

export interface GraphResult {
  edges: GraphEdge[]
  ghostPaths: string[]
  findings: Finding[]
}

export function buildGraph(taskbots: Taskbot[]): GraphResult {
  const byPath = new Map(taskbots.map((t) => [t.path, t]))
  const edgeMap = new Map<string, GraphEdge>()
  const ghosts = new Set<string>()
  const findings: Finding[] = []

  for (const bot of taskbots) {
    const declared = new Set(bot.variables.map((v) => v.name))
    for (const call of bot.calls) {
      const key = bot.path + '→' + call.targetPath
      const edge = edgeMap.get(key) ?? { from: bot.path, to: call.targetPath, calls: [] }
      edge.calls.push(call)
      edgeMap.set(key, edge)

      const callee = byPath.get(call.targetPath)
      if (!callee) {
        if (!ghosts.has(call.targetPath)) {
          ghosts.add(call.targetPath)
          findings.push({
            ruleId: 'MISSING_DEPENDENCY',
            severity: 'info',
            botPath: bot.path,
            line: call.line,
            params: { target: call.targetPath, line: String(call.line) },
          })
        }
      } else {
        const calleeInputs = new Set(callee.variables.filter((v) => v.input).map((v) => v.name))
        for (const input of call.inputs) {
          if (!calleeInputs.has(input.calleeVar)) {
            findings.push({
              ruleId: 'CALL_INPUT_UNKNOWN',
              severity: 'error',
              botPath: bot.path,
              line: call.line,
              varName: input.calleeVar,
              params: { line: String(call.line), var: input.calleeVar, callee: callee.name },
            })
          }
        }
      }
      // caller-side: expression references undeclared caller vars
      for (const input of call.inputs) {
        for (const cv of input.callerVars) {
          if (!declared.has(cv) && !isSystemVar(cv)) {
            findings.push({
              ruleId: 'CALL_VAR_UNDECLARED',
              severity: 'error',
              botPath: bot.path,
              line: call.line,
              varName: cv,
              params: { line: String(call.line), var: cv },
            })
          }
        }
      }
    }
  }
  return { edges: [...edgeMap.values()], ghostPaths: [...ghosts], findings }
}

/** $System:...$, $SystemVariablesPackage:...$ etc. — the ref extractor already stops at ':', so these come through as bare package names. */
function isSystemVar(name: string): boolean {
  return name === 'System' || name === 'SystemVariablesPackage' || name.startsWith('System')
}
