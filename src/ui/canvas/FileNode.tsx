import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { fileIcon, type FileNodeData } from './nodeTypes'

export default function FileNode({ data }: NodeProps<Node<FileNodeData>>) {
  return (
    <div className={'file-node kind-' + data.kind} title={data.path}>
      <Handle type="target" position={Position.Left} id="file-in" className="file-handle" />
      <span className="file-icon">{fileIcon(data.ext)}</span>
      <span className="file-label">
        <span className="file-name">{data.label}</span>
        <span className="file-kind">{data.ext}</span>
      </span>
    </div>
  )
}
