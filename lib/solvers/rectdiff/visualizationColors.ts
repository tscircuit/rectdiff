export function getColorForZLayer(zLayerList: number[]): {
  fill: string
  stroke: string
} {
  const minZLayerIndex = Math.min(...zLayerList)
  const colorStyleList = [
    { fill: "#dbeafe", stroke: "#3b82f6" },
    { fill: "#fef3c7", stroke: "#f59e0b" },
    { fill: "#d1fae5", stroke: "#10b981" },
    { fill: "#e9d5ff", stroke: "#a855f7" },
    { fill: "#fed7aa", stroke: "#f97316" },
    { fill: "#fecaca", stroke: "#ef4444" },
  ] as const

  return colorStyleList[minZLayerIndex % colorStyleList.length]!
}
