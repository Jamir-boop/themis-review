import type { Finding, Taskbot } from '../model'

export function messageBoxRules(bot: Taskbot): Finding[] {
  const out: Finding[] = []
  for (const a of bot.actions) {
    if (a.commandName !== 'messageBox') continue
    if (a.reachable) {
      out.push({
        ruleId: 'MSGBOX_UNATTENDED',
        severity: 'error',
        botPath: bot.path,
        line: a.line,
        params: { line: String(a.line) },
      })
    } else {
      out.push({
        ruleId: 'MSGBOX_DEAD',
        severity: 'warn',
        botPath: bot.path,
        line: a.line,
        params: { line: String(a.line) },
      })
    }
  }
  return out
}
