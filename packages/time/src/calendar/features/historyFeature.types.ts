/** API contributed by `historyFeature` — undo/redo over event mutations. */
export interface Calendar_History {
  /** Revert the last mutating action. */
  undo(): void
  /** Re-apply the last undone action. */
  redo(): void
  /** True when there is at least one action to undo. */
  canUndo(): boolean
  /** True when there is at least one action to redo. */
  canRedo(): boolean
}
