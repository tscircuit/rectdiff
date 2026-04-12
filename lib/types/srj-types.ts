export type TraceId = string

export interface SimpleRouteJson {
  layerCount: number
  minTraceWidth: number
  minViaDiameter?: number
  obstacles: Obstacle[]
  connections: Array<SimpleRouteConnection>
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
  outline?: Array<{ x: number; y: number }>
}

export interface Obstacle {
  type: "rect"
  layers: string[]
  zLayers?: number[]
  center: { x: number; y: number }
  width: number
  height: number
  connectedTo: TraceId[]
  netIsAssignable?: boolean
  offBoardConnectsTo?: TraceId[]
}

export interface SimpleRouteConnection {
  name: string
  netConnectionName?: string
  nominalTraceWidth?: number
  pointsToConnect: Array<{
    x: number
    y: number
    layer: string
    pointId?: string
    pcb_port_id?: string
  }>
  externallyConnectedPointIds?: string[][]
}
