import {expect,test} from 'bun:test'
import {FindSegmentsWithAdjacentEmptySpaceSolver} from '../lib/solvers/GapFillSolver/FindSegmentsWithAdjacentEmptySpaceSolver'
import type {CapacityMeshNode} from '../lib/types/capacity-mesh-types'

test('finite edge enumeration processes every edge in a dense two-layer grid',()=>{
 const side=114
 const nodes:CapacityMeshNode[]=Array.from({length:side*side},(_,i)=>({capacityMeshNodeId:`node_${i}`,center:{x:i%side,y:Math.floor(i/side)},width:1,height:1,layer:'top',availableZ:[0,1]}))
 const solver=new FindSegmentsWithAdjacentEmptySpaceSolver({allMeshNodes:nodes})
 solver.solve()
 expect({solved:solver.solved,failed:solver.failed,error:solver.error}).toMatchObject({solved:true,failed:false})
 expect(solver.unprocessedEdges).toHaveLength(0)
 const segments=solver.getOutput().segmentsWithAdjacentEmptySpace
 expect(segments).toHaveLength(side*4*2)
 expect(segments.every(s=>s.start.x===-.5&&s.end.x===-.5||s.start.x===side-.5&&s.end.x===side-.5||s.start.y===-.5&&s.end.y===-.5||s.start.y===side-.5&&s.end.y===side-.5)).toBe(true)
})
