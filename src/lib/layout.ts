/** Side-by-side lanes for blocks that overlap within one day */
export function layoutLanes<T extends { id: string; start: number; end: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const result = new Map<string, { lane: number; lanes: number }>()
  let cluster: T[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const it of cluster) result.get(it.id)!.lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const it of sorted) {
    if (it.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= it.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(it.end)
    } else laneEnds[lane] = it.end
    result.set(it.id, { lane, lanes: 0 })
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()
  return result
}
