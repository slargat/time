/** API contributed by `lazyFetchFeature` — on-demand event loading. */
export interface Calendar_LazyFetch {
  /** Fetch + merge events for an arbitrary range (no-op if already loaded). */
  fetchEventsForRange: (start: string, end: string) => Promise<void>
  /** Fetch the current view's range if not yet loaded (call from a view effect). */
  ensureRangeLoaded: () => void
  /** The ranges already fetched (merged/normalized). */
  getLoadedRanges: () => ReadonlyArray<{ start: string; end: string }>
}
