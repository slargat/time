import type React from 'react'

interface HorizontalResizeHandleProps {
  edge: 'left' | 'right'
  onMouseDown: (e: React.MouseEvent) => void
}

export function HorizontalResizeHandle({
  edge,
  onMouseDown,
}: HorizontalResizeHandleProps) {
  return (
    <div
      data-resize-handle
      className={`absolute top-0 bottom-0 w-3 cursor-ew-resize z-30 bg-transparent hover:bg-neutral-500/30 pointer-events-auto ${
        edge === 'left' ? 'left-0' : 'right-0'
      }`}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        e.stopPropagation()
      }}
      style={{ touchAction: 'none' }}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-8 w-1 bg-neutral-400 rounded opacity-50 group-hover:opacity-100 transition-opacity ${
          edge === 'left' ? 'left-1' : 'right-1'
        }`}
      />
    </div>
  )
}
