import type {Plant} from '../game/model';
type State=NonNullable<Plant['squash']>;
export function squashClip(s:State,x:number) {
  return s.remaining>105?(s.x<x?'squash-look-left':'squash-look-right'):s.remaining>10?'squash-rise':'squash-attack';
}
export function squashTicks(s:State) {
  return s.remaining>105?185-s.remaining:s.remaining>10?105-s.remaining:10-s.remaining+(s.remaining===0?100-(s.restIn??100):0);
}
// TodCurves::CURVE_EASE_IN_OUT is TodCurveS(TodCurveS(t)).
const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));t=t*t*(3-2*t);return t*t*(3-2*t);};
export function squashPosition(s:State,x:number,y:number,targetY:number):[number,number] {
  if(s.remaining>60)return [x,y];
  const targetX=Math.trunc(s.x-40)+40;
  if(s.remaining<=10)return [targetX,Math.round(targetY-s.remaining*12)];
  const age=60-s.remaining;
  return [Math.round(x+(targetX-x)*ease(age/30)),Math.round(y+(targetY-120-y)*ease(age/30))];
}
