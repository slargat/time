import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type { Connection, Edge, Node, NodeProps } from '@xyflow/react'
import type {
  Event,
  Resource,
  TimelineLayout,
  TimelineResourceRow,
} from '@tanstack/time'
import { DEP_TYPE_STYLES } from '@/lib/dep-styles'

const DEP_HANDLE_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  background: '#f59e0b',
  border: '2px solid #78350f',
  borderRadius: '50%',
  pointerEvents: 'all',
  cursor: 'crosshair',
  opacity: 0.85,
  zIndex: 40,
}

interface HandlePosition {
  eventId: string
  x: number
  y: number
  width: number
  height: number
}

function DepCanvasNode({ data }: NodeProps) {
  const { handlePositions } = data as { handlePositions: Array<HandlePosition> }
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {handlePositions.map(({ eventId, x, y, width, height }) => (
        <React.Fragment key={eventId}>
          <Handle
            type="target"
            position={Position.Left}
            id={`${eventId}-target-start`}
            style={{
              ...DEP_HANDLE_STYLE,
              position: 'absolute',
              left: x,
              right: 'auto',
              top: y + height / 2,
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id={`${eventId}-source-start`}
            style={{
              ...DEP_HANDLE_STYLE,
              position: 'absolute',
              left: x,
              right: 'auto',
              top: y + height / 2,
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
              opacity: 0,
            }}
          />
          <Handle
            type="target"
            position={Position.Right}
            id={`${eventId}-target-end`}
            style={{
              ...DEP_HANDLE_STYLE,
              position: 'absolute',
              left: x + width,
              right: 'auto',
              top: y + height / 2,
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
              opacity: 0,
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id={`${eventId}-source-end`}
            style={{
              ...DEP_HANDLE_STYLE,
              position: 'absolute',
              left: x + width,
              right: 'auto',
              top: y + height / 2,
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
            }}
          />
        </React.Fragment>
      ))}
    </div>
  )
}

const DEP_CANVAS_NODE_TYPES = { depCanvas: DepCanvasNode }
const CANVAS_NODE_ID = '__dep_canvas__'

function buildTimelineEdges(events: Array<Event<Resource>>): Array<Edge> {
  const visibleEventIds = new Set(events.map((e) => e.id))

  return events.flatMap((event) => {
    const deps = (event.dependsOn ?? []).filter((d) =>
      visibleEventIds.has(d.id),
    )

    return deps.map((dep) => {
      const style = DEP_TYPE_STYLES[dep.type]
      const sourceAnchor =
        dep.type === 'SS' || dep.type === 'SF' ? 'start' : 'end'
      const targetAnchor =
        dep.type === 'FF' || dep.type === 'SF' ? 'end' : 'start'
      return {
        id: `dep-${dep.id}-${event.id}-${dep.type}`,
        source: CANVAS_NODE_ID,
        sourceHandle: `${dep.id}-source-${sourceAnchor}`,
        target: CANVAS_NODE_ID,
        targetHandle: `${event.id}-target-${targetAnchor}`,
        type: 'smoothstep',
        animated: true,
        label: dep.type,
        labelStyle: {
          fill: '#fff',
          fontSize: 10,
          fontWeight: 700,
        },
        labelBgStyle: {
          fill: style.color,
          opacity: 0.95,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        style: {
          stroke: style.color,
          strokeWidth: 2,
          strokeDasharray: style.strokeDasharray,
        },
      }
    })
  })
}

interface TimelineDependencyOverlayProps {
  timelineLayout: TimelineLayout<Resource, Event<Resource>>
  eventBarRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  rowsContainerRef: React.RefObject<HTMLDivElement | null>
  resizeState: {
    isResizing: boolean
    eventId: string | null
    previewStart: string | null
    previewEnd: string | null
  }
  activeDragEvent: unknown
  onDependencyCreate: (
    sourceId: string,
    targetId: string,
    sourceAnchor: 'start' | 'end',
    targetAnchor: 'start' | 'end',
  ) => void
}

export function TimelineDependencyOverlay({
  timelineLayout,
  rowsContainerRef,
  resizeState,
  activeDragEvent,
  onDependencyCreate,
  eventBarRefs,
}: TimelineDependencyOverlayProps) {
  const [rfNodes, setRfNodes, onNodesChangeBase] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const isConnectingRef = useRef(false)

  const lockScroll = useCallback(() => {
    isConnectingRef.current = true
  }, [])

  const unlockScroll = useCallback(() => {
    isConnectingRef.current = false
  }, [])

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeBase>[0]) => {
      const filtered = changes.filter(
        (c) => !('id' in c && c.id === CANVAS_NODE_ID),
      )
      if (filtered.length > 0) onNodesChangeBase(filtered)
    },
    [onNodesChangeBase],
  )

  const updatePositions = useCallback(() => {
    const container = rowsContainerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const positions: Array<HandlePosition> = []

    timelineLayout.rows.forEach((row: TimelineResourceRow) => {
      row.events.forEach((e) => {
        const el = eventBarRefs.current.get(e.event.id)
        if (!el) return

        const rect = el.getBoundingClientRect()
        positions.push({
          eventId: e.event.id,
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        })
      })
    })

    setRfNodes([
      {
        id: CANVAS_NODE_ID,
        type: 'depCanvas',
        position: { x: 0, y: 0 },
        width: containerRect.width,
        height: containerRect.height,
        style: { width: containerRect.width, height: containerRect.height },
        data: { handlePositions: positions },
        selectable: false,
        draggable: false,
      },
    ])
    const allEvents = Array.from(
      new Map(
        timelineLayout.rows
          .flatMap((r) => r.events.map((e) => e.event))
          .map((e) => [e.id, e]),
      ).values(),
    )
    setRfEdges(buildTimelineEdges(allEvents))
  }, [timelineLayout, rowsContainerRef, eventBarRefs, setRfNodes, setRfEdges])

  useLayoutEffect(() => {
    updatePositions()
  }, [updatePositions, resizeState, activeDragEvent])

  useEffect(() => {
    const container = rowsContainerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => updatePositions())
    observer.observe(container)
    return () => observer.disconnect()
  }, [rowsContainerRef, updatePositions])

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceMatch = connection.sourceHandle?.match(
        /^(.+)-source-(start|end)$/,
      )
      const targetMatch = connection.targetHandle?.match(
        /^(.+)-target-(start|end)$/,
      )
      if (!sourceMatch || !targetMatch) return

      const sourceEventId = sourceMatch[1]
      const sourceAnchor = sourceMatch[2] as 'start' | 'end'
      const targetEventId = targetMatch[1]
      const targetAnchor = targetMatch[2] as 'start' | 'end'

      if (sourceEventId === targetEventId) return
      onDependencyCreate(
        sourceEventId,
        targetEventId,
        sourceAnchor,
        targetAnchor,
      )
    },
    [onDependencyCreate],
  )

  return (
    <ReactFlow
      className="timeline-dep-flow"
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onConnectStart={lockScroll}
      onConnectEnd={unlockScroll}
      nodeTypes={DEP_CANVAS_NODE_TYPES}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      panOnDrag={false}
      zoomOnScroll={false}
      panOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={true}
      elementsSelectable={false}
      preventScrolling={false}
      autoPanOnConnect={false}
      style={{
        background: 'transparent',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
      proOptions={{ hideAttribution: true }}
      autoPanOnNodeDrag={false}
    />
  )
}
