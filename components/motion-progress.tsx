import type {CSSProperties} from 'react';
export function MotionProgress({value,max,label}:{value:number;max:number;label?:string}){
 const ratio=Number.isFinite(value)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,value/max)):0;
 return <div className="motion-progress"><progress className="sr-only" value={value} max={max} aria-label={label}/><span aria-hidden="true"><i style={{transform:`scaleX(${ratio})`} as CSSProperties}/></span></div>;
}
