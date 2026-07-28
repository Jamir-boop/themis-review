import { useEffect, useMemo, useRef, useState } from 'react'
import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ProjectAnalysis } from '../../core/model'
import TaskbotNode from './TaskbotNode'
import FileNode from './FileNode'
import { FILE_NODE_HEIGHT, FILE_NODE_WIDTH, NODE_WIDTH, nodeHeight, typeColor, type FileNodeData, type TBNodeData } from './nodeTypes'
import { useT } from '../i18n'

const nodeTypes = { taskbot: TaskbotNode, file: FileNode }

type FlowNode = Node<TBNodeData> | Node<FileNodeData>

function buildFlow(a: ProjectAnalysis): { nodes: FlowNode[]; edges: Edge[] } {
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

  const nodes: FlowNode[] = []
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

  // static files that at least one taskbot references; shown as small nodes, never analyzed
  const referenced = new Set(a.fileEdges.map((fe) => fe.to))
  for (const f of a.otherFiles) {
    if (!referenced.has(f.path)) continue
    const label = f.path.split('/').pop() ?? f.path
    nodes.push({
      id: f.path,
      type: 'file',
      position: { x: 0, y: 0 },
      data: { label, path: f.path, kind: f.kind, ext: (label.split('.').pop() ?? '').toLowerCase() },
    })
  }

  const edges: Edge[] = []
  const seenWire = new Set<string>()
  for (const fe of a.fileEdges) {
    edges.push({
      id: 'file:' + fe.from + '→' + fe.to,
      source: fe.from,
      target: fe.to,
      sourceHandle: 'call-out',
      targetHandle: 'file-in',
      className: 'edge-file',
    })
  }
  for (const e of a.edges) {
    edges.push({
      id: 'call:' + e.from + '→' + e.to,
      source: e.from,
      target: e.to,
      sourceHandle: 'call-out',
      targetHandle: 'call-in',
      className: 'edge-call',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#ffb900' },
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

async function layout(nodes: FlowNode[], edges: Edge[]): Promise<FlowNode[]> {
  const ELK = (await import('elkjs/lib/elk.bundled.js')).default
  const elk = new ELK()
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
    },
    children: nodes.map((n) =>
      n.type === 'file'
        ? { id: n.id, width: FILE_NODE_WIDTH, height: FILE_NODE_HEIGHT }
        : { id: n.id, width: NODE_WIDTH, height: nodeHeight(n.data as TBNodeData) },
    ),
    // call + file edges shape the layout so assets settle next to the bot that uses them
    edges: edges
      .filter((e) => e.id.startsWith('call:') || e.id.startsWith('file:'))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  }
  const res = await elk.layout(graph)
  const pos = new Map(res.children?.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]))
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? { x: 0, y: 0 } }))
}

export default function Canvas({
  analysis,
  onSelect,
  focus,
}: {
  analysis: ProjectAnalysis
  onSelect: (path: string) => void
  focus?: { path: string; nonce: number } | null
}) {
  const t = useT()
  const { nodes: rawNodes, edges } = useMemo(() => buildFlow(analysis), [analysis])
  const [nodes, setNodes] = useState<FlowNode[] | null>(null)
  const [rf, setRf] = useState<ReactFlowInstance<FlowNode, Edge> | null>(null)
  // nodes are read through a ref here: keeping them in the effect's deps made every
  // drag (which rewrites the array) recentre the viewport mid-gesture
  const nodesRef = useRef<FlowNode[] | null>(null)
  nodesRef.current = nodes
  const handledFocus = useRef(-1)
  // flips once when the async layout lands; unlike `nodes` it doesn't change on drag
  const layoutReady = nodes !== null

  // centre the node a report row asked for. Uses the laid-out geometry rather than
  // fitView, which silently does nothing until React Flow has measured the nodes.
  useEffect(() => {
    if (!focus || !rf || focus.nonce === handledFocus.current) return
    const node = nodesRef.current?.find((n) => n.id === focus.path)
    if (!node) return
    handledFocus.current = focus.nonce
    const w = node.type === 'file' ? FILE_NODE_WIDTH : NODE_WIDTH
    const h = node.type === 'file' ? FILE_NODE_HEIGHT : nodeHeight(node.data as TBNodeData)
    const zoom = Math.min(Math.max(rf.getZoom(), 0.6), 1.2)
    // duration 0: an animated pan depends on requestAnimationFrame, which never runs
    // while the tab is backgrounded, leaving the viewport silently unmoved
    rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 0 })
    // must return the same array when nothing changes, or this effect re-triggers itself
    setNodes((ns) => {
      if (!ns) return ns
      let changed = false
      const next = ns.map((n) => {
        const selected = n.id === focus.path
        if (n.selected === selected) return n
        changed = true
        return { ...n, selected }
      })
      return changed ? next : ns
    })
    // `nodes` deliberately excluded — see nodesRef above
  }, [focus, rf, layoutReady])

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
      onInit={setRf}
      onNodesChange={(chs) => setNodes((ns) => (ns ? applyNodeChanges(chs, ns) : ns))}
      onNodeClick={(_, n) => {
        if (n.type === 'taskbot' && !(n.data as TBNodeData).ghost) onSelect(n.id)
      }}
      nodesDraggable
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} />
      <Controls showInteractive={false} />
      <MiniMap position="bottom-left" pannable zoomable />
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
        <span>
          <i className="leg-file" /> {t('canvas.legend.file')}
        </span>
      </div>
    </ReactFlow>
  )
}
