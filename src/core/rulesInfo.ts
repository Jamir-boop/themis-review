import type { Severity } from './model'
import { capGroup } from './score'

/** Registry of every rule the engine can emit, for the Rules reference view.
 *
 *  The rule modules in ./rules stay the source of truth for behaviour: a few rules
 *  choose their severity at runtime (VAR_NO_DESCRIPTION is a warning on an
 *  input/output and info on a local), so `severity` here describes the common case.
 *  tests/rules-info.test.ts fails if a rule fires without being registered. */

export type RuleCategory = 'naming' | 'messagebox' | 'structure' | 'hygiene' | 'graph'

export interface RuleInfo {
  id: string
  severity: Severity
  category: RuleCategory
  /** rules sharing a cap group also share the per-family deduction cap */
  capGroup: string
}

const RULE_SEED: { id: string; severity: Severity; category: RuleCategory }[] = [
  // naming convention, from the core_framework guide
  { id: 'VAR_NAME_FORMAT', severity: 'warn', category: 'naming' },
  { id: 'VAR_SCOPE_MISMATCH', severity: 'warn', category: 'naming' },
  { id: 'VAR_TYPE_MISMATCH', severity: 'warn', category: 'naming' },
  { id: 'VAR_BOOL_NAME', severity: 'info', category: 'naming' },
  { id: 'VAR_NO_DESCRIPTION', severity: 'warn', category: 'naming' },
  { id: 'VAR_NO_DESCRIPTION_LOCAL', severity: 'info', category: 'naming' },
  // message boxes
  { id: 'MSGBOX_BLOCKING', severity: 'error', category: 'messagebox' },
  { id: 'MSGBOX_DEAD', severity: 'warn', category: 'messagebox' },
  { id: 'MSGBOX_OVER_LOGS', severity: 'warn', category: 'messagebox' },
  // structure
  { id: 'EMPTY_CATCH', severity: 'error', category: 'structure' },
  { id: 'TOO_LONG', severity: 'error', category: 'structure' },
  { id: 'HARDCODED_PATH', severity: 'warn', category: 'structure' },
  { id: 'NO_ERROR_HANDLING', severity: 'warn', category: 'structure' },
  { id: 'DISABLED_CODE', severity: 'info', category: 'structure' },
  { id: 'DEEP_NESTING', severity: 'info', category: 'structure' },
  // hygiene
  { id: 'NO_LOGS', severity: 'warn', category: 'hygiene' },
  { id: 'LOW_COMMENTS', severity: 'info', category: 'hygiene' },
  { id: 'UNUSED_VAR', severity: 'info', category: 'hygiene' },
  // call graph
  { id: 'CALL_DEPTH', severity: 'error', category: 'graph' },
  { id: 'CALL_INPUT_UNKNOWN', severity: 'error', category: 'graph' },
  { id: 'CALL_VAR_UNDECLARED', severity: 'error', category: 'graph' },
  { id: 'MISSING_DEPENDENCY', severity: 'info', category: 'graph' },
]

export const RULES: RuleInfo[] = RULE_SEED.map((r) => ({ ...r, capGroup: capGroup(r.id) }))

export const RULE_IDS = new Set(RULES.map((r) => r.id))
