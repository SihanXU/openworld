import { describe, it, expect } from 'vitest'
import { fitFloating } from '../src/ui/components/floating.ts'

describe('floating UI placement', () => {
  it('flips left and moves up at the bottom right edge', () => {
    expect(fitFloating({x:388,y:842,width:0,height:0},{width:200,height:300},{x:0,y:0,width:390,height:844})).toEqual({x:180,y:536})
  })
  it('respects an offset visual viewport, including oversized content', () => {
    expect(fitFloating({x:10,y:10,width:40,height:40},{width:500,height:600},{x:30,y:100,width:320,height:400})).toEqual({x:38,y:108})
  })
  it('keeps a tip beside an anchor when there is room', () => {
    expect(fitFloating({x:100,y:100,width:32,height:32},{width:200,height:100},{x:0,y:0,width:1024,height:768})).toEqual({x:140,y:100})
  })
})
