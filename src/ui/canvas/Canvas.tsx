import { useEffect, useMemo, useState } from 'react'
import { applyNodeChanges, Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import ELK from 'elkjs/lib/elk.bundled.js'
import '@xyflow/react/dist/style.css'
import type { ProjectAnalysis } from '../../core/model'
import TaskbotNode from './TaskbotNode'
import { NODE_WIDTH, nodeHeight, typeColor, type TBNodeData } from './nodeTypes'
import { useT } from '../i18n'

const nodeTypes = { taskbot: TaskbotNode }
const elk = new ELK()

function buildFlow(a: ProjectAnalysis): { nodes: Node<TBNodeData>[]; edges: Edge[] } {
  const byPath = new Map(a.taskbots.map((t) => [t.path, t]))

  // vars per bot that feed outgoing call wires
  const wireOut = new Map<string, Set<string>>()
  for (const e of a.edges) {
    for (const c of e.calls) {
      for (const i of c.inputs) {
        if (i.callerVars.length > 0) {
          const s = wireOut.get(e.from) ?? new Set()
          i.callerVars.forEach((v) => s.add(v))
          wireOut.set(e.from, s)
        }
      }
    }
  }

  const nodes: Node<TBNodeData>[] = []
  for (const bot of a.taskbots) {
    const vtypes = new Map(bot.variables.map((v) => [v.name, v.type]))
    const data: TBNodeData = {
      label: bot.name,
      path: bot.path,
      ghost: false,
      metrics: a.metrics[bot.path],
      score: a.scores[bot.path],
      inputVars: bot.variables.filter((v) => v.input).map((v) => ({ name: v.name, type: v.type })),
      wireOutVars: [...(wireOut.get(bot.path) ?? [])].map((n) => ({ name: n, type: vtypes.get(n) ?? 'ANY' })),
      outputVars: bot.variables.filter((v) => v.output).map((v) => v.name),
      findingsCount: a.findings.filter((f) => f.botPath === bot.path).length,
    }
    nodes.push({ id: bot.path, type: 'taskbot', position: { x: 0, y: 0 }, data })
  }
  for (const g of a.ghostPaths) {
    nodes.push({
      id: g,
      type: 'taskbot',
      position: { x: 0, y: 0 },
      data: {
        label: g.split('/').pop() ?? g,
        path: g,
        ghost: true,
        inputVars: [],
        wireOutVars: [],
        outputVars: [],
        findingsCount: 0,
      },
    })
  }

  const edges: Edge[] = []
  const seenWire = new Set<string>()
  for (const e of a.edges) {
    edges.push({
      id: 'call:' + e.from + '→' + e.to,
      source: e.from,
      target: e.to,
      sourceHandle: 'call-out',
      targetHandle: 'call-in',
      className: 'edge-call',
      label: e.calls.length > 1 ? '×' + e.calls.length : undefined,
    })
    const callee = byPath.get(e.to)
    if (!callee) continue
    const calleeInputs = new Set(callee.variables.filter((v) => v.input).map((v) => v.name))
    const calleeTypes = new Map(callee.variables.map((v) => [v.name, v.type]))
    for (const c of e.calls) {
      for (const i of c.inputs) {
        if (i.callerVars.length === 0 || !calleeInputs.has(i.calleeVar)) continue
        const src = i.callerVars[0]
        const key = e.from + '|' + src + '→' + e.to + '|' + i.calleeVar
        if (seenWire.has(key)) continue
        seenWire.add(key)
        edges.push({
          id: 'wire:' + key,
          source: e.from,
          target: e.to,
          sourceHandle: 'out:' + src,
          targetHandle: 'in:' + i.calleeVar,
          className: 'edge-wire',
          style: { stroke: typeColor(calleeTypes.get(i.calleeVar) ?? 'ANY'), strokeWidth: 1.5 },
        })
      }
    }
  }
  return { nodes, edges }
}

async function layout(nodes: Node<TBNodeData>[], edges: Edge[]): Promise<Node<TBNodeData>[]> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
    },
    children: nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: nodeHeight(n.data) })),
    edges: edges
      .filter((e) => e.id.startsWith('call:'))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }
  const res = await elk.layout(graph)
  const pos = new Map(res.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]))
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? { x: 0, y: 0 } }))
}

export default function Canvas({ analysis, onSelect }: { analysis: ProjectAnalysis; onSelect: (path: string) => void }) {
  const t = useT()
  const { nodes: rawNodes, edges } = useMemo(() => buildFlow(analysis), [analysis])
  const [nodes, setNodes] = useState<Node<TBNodeData>[] | null>(null)

  useEffect(() => {
    let alive = true
    void layout(rawNodes, edges).then((n) => {
      if (alive) setNodes(n)
    })
    return () => {
      alive = false
    }
  }, [rawNodes, edges])

  if (!nodes) return <div className="canvas-loading">…</div>

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={(chs) => setNodes((ns) => (ns ? applyNodeChanges(chs, ns) : ns))}
      onNodeClick={(_, n) => {
        if (!(n.data as TBNodeData).ghost) onSelect(n.id)
      }}
      nodesDraggable
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
      <div className="legend">
        <span>
          <i className="leg-call" /> {t('canvas.legend.call')}
        </span>
        <span>
          <i className="leg-wire" /> {t('canvas.legend.wire')}
        </span>
        <span>
          <i className="leg-ghost" /> {t('canvas.legend.ghost')}
        </span>
      </div>
    </ReactFlow>
  )
}
