import * as THREE from 'three';
import {landingMotion} from '@/lib/landing-motion';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

type LightingTheme='dark'|'light';
const lighting={
 dark:{material:0x8580b5,sky:0xb2bbff,ground:0x21152f,key:0xeee8ff,rim:0x4d82ff,fill:0xd66dba,node:0xdccaff,emissive:0xa07ae0,edge:0xba9cf3,pulse:0x9c9ff0,exposure:.8,ambient:.44,keyPower:20,rimPower:34,fillPower:22,metalness:.17,roughness:.5,clearcoat:.22,iridescence:.42,environment:.64},
 light:{material:0xc4bfd4,sky:0xf9faf7,ground:0x91ada3,key:0xfff3e5,rim:0x8ccbbf,fill:0xb7a2d0,node:0xf8f0fe,emissive:0x869dab,edge:0x80708b,pulse:0x688e91,exposure:.98,ambient:.86,keyPower:25,rimPower:18,fillPower:13,metalness:.08,roughness:.58,clearcoat:.15,iridescence:.24,environment:.7},
} as const;
const colorKeys=['material','sky','ground','key','rim','fill','node','emissive','edge','pulse'] as const;
const scalarKeys=['exposure','ambient','keyPower','rimPower','fillPower','metalness','roughness','clearcoat','iridescence','environment'] as const;

/** Trace a connected sequence of actual cortical triangle edges, not a proxy sphere. */
function corticalPath(geometry:THREE.BufferGeometry):THREE.Vector3[] {
 const positions=geometry.attributes.position,normals=geometry.attributes.normal;
 if(!positions||positions.count<20)return[];
 const points:THREE.Vector3[]=[],surfaceNormals:THREE.Vector3[]=[],vertices:number[]=[],lookup=new Map<string,number>();
 for(let i=0;i<positions.count;i++){
  const point=new THREE.Vector3().fromBufferAttribute(positions,i),key=`${Math.round(point.x*1e5)},${Math.round(point.y*1e5)},${Math.round(point.z*1e5)}`;
  let id=lookup.get(key);if(id===undefined){id=points.length;lookup.set(key,id);points.push(point);surfaceNormals.push(normals?new THREE.Vector3().fromBufferAttribute(normals,i):point.clone().normalize());}vertices.push(id);
 }
 const neighbors=points.map(()=>new Set<number>()),indices=geometry.index;
 const count=indices?.count??positions.count;
 for(let i=0;i<count;i+=3){const a=vertices[indices?indices.getX(i):i],b=vertices[indices?indices.getX(i+1):i+1],c=vertices[indices?indices.getX(i+2):i+2];neighbors[a].add(b).add(c);neighbors[b].add(a).add(c);neighbors[c].add(a).add(b);}
 const box=new THREE.Box3().setFromPoints(points),size=box.getSize(new THREE.Vector3()),axis=size.x>size.y&&size.x>size.z?'x':size.y>size.z?'y':'z';
 // Multi-primitive anatomical meshes can contain tiny disconnected fragments.
 // Trace the largest connected component rather than an isolated extremal triangle.
 const visited=new Uint8Array(points.length);let component:number[]=[];
 for(let seed=0;seed<points.length;seed++)if(!visited[seed]){const connected=[seed];visited[seed]=1;for(let i=0;i<connected.length;i++)for(const next of neighbors[connected[i]])if(!visited[next]){visited[next]=1;connected.push(next);}if(connected.length>component.length)component=connected;}
 let start=component[0]??0;for(const i of component)if(points[i][axis]<points[start][axis])start=i;
 const previous=new Int32Array(points.length).fill(-1),queue=[start];previous[start]=start;let end=start;
 for(let i=0;i<queue.length;i++){const current=queue[i];if(points[current][axis]>points[end][axis])end=current;for(const next of neighbors[current])if(previous[next]===-1){previous[next]=current;queue.push(next);}}
 const path:number[]=[];for(let at=end;at!==start;at=previous[at])path.push(at);path.push(start);path.reverse();
 return path.length<5?[]:path.map(i=>points[i].clone().addScaledVector(surfaceNormals[i],.009));
}

/** Anatomical geometry stays mounted while its material and illumination change worlds. */
export function mountSculpture(host:HTMLDivElement):()=>void {
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return()=>{};}
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setClearColor(0,0);
 const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06,.1,100,{size:innerWidth<700?32:64});scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const ambient=new THREE.HemisphereLight(),keyLight=new THREE.PointLight(0xffffff,20,25,2),rimLight=new THREE.PointLight(0xffffff,34,25,2),fillLight=new THREE.PointLight(0xffffff,22,25,2);
 keyLight.position.set(3,5,5);rimLight.position.set(-4,1,3);fillLight.position.set(2,-3,2);scene.add(ambient,keyLight,rimLight,fillLight);
 const group=new THREE.Group();group.position.x=-.35;scene.add(group);
 const material=new THREE.MeshPhysicalMaterial({clearcoatRoughness:.4,iridescenceIOR:1.3,iridescenceThicknessRange:[180,380]});
 let brainGeometry:THREE.BufferGeometry|undefined,loaded=false;
 const decoder=new DRACOLoader().setDecoderPath('/stitch/draco/').setWorkerLimit(1),loader=new GLTFLoader().setDRACOLoader(decoder);
 const releaseSource=(root:THREE.Object3D)=>root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});
 const nodeGeometry=new THREE.SphereGeometry(.035,10,8),nodeMaterial=new THREE.MeshStandardMaterial({emissiveIntensity:.7,roughness:.5});
 const nodes=Array.from({length:4},(_,i)=>{const node=new THREE.Mesh(nodeGeometry,nodeMaterial);group.add(node);return{node,base:new THREE.Vector3((i%2?1:-1)*.8,i<2?.7:-.6,.6),outer:new THREE.Vector3((i%2?1:-1)*1.9,i<2?1.2:-1.1,.3)};});
 const edgeGeometry=new THREE.BufferGeometry(),edgePositions=new Float32Array(4*6);edgeGeometry.setAttribute('position',new THREE.BufferAttribute(edgePositions,3));
 const edgeMaterial=new THREE.LineBasicMaterial({transparent:true,opacity:0});group.add(new THREE.LineSegments(edgeGeometry,edgeMaterial));
 const pulseColor={value:new THREE.Color()},pulseTime={value:0},pulseMotion={value:1};
 const pathMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:pulseTime,uColor:pulseColor,uMotion:pulseMotion},vertexShader:'attribute float pathProgress; varying float vProgress; void main(){ vProgress=pathProgress; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'uniform float uTime; uniform float uMotion; uniform vec3 uColor; varying float vProgress; void main(){float head=fract(uTime*.09);float distanceFromHead=abs(vProgress-head);float pulse=exp(-distanceFromHead*distanceFromHead*220.0);gl_FragColor=vec4(uColor,(.035+pulse*.45)*uMotion);\n#include <colorspace_fragment>\n}',toneMapped:false});
 const pathGeometries:THREE.BufferGeometry[]=[];
 let opening=0,fitDistance=0;
 const articulate=(amount:number)=>{opening=amount;if(fitDistance)camera.position.z=fitDistance*(.72+amount*.16);host.dataset.networkState=amount>.8?'expanded':amount<.05?'connected':'opening';nodes.forEach(({node,base,outer},i)=>{node.position.copy(base).lerp(outer,amount);node.scale.setScalar(.4+amount*.6);base.toArray(edgePositions,i*6);node.position.toArray(edgePositions,i*6+3);});edgeGeometry.attributes.position.needsUpdate=true;edgeMaterial.opacity=amount*.5;};
 articulate(0);
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)'),hero=host.closest<HTMLElement>('.landing-hero')||host;
 const modelRequest=new AbortController();
 let contextLost=false,failed=false,dead=false,visible=true,frame=0,elapsed=0,last=0,frames=0,frameCost=0,targetX=0,targetY=0,x=0,y=0,lastEnergyAt=0;
 let dpr=Math.min(devicePixelRatio,innerWidth<700?1.15:1.6);
 let theme:LightingTheme=document.documentElement.dataset.theme==='light'?'light':'dark',themeStarted=performance.now()-landingMotion.themeMs;
 const colors=Object.fromEntries(colorKeys.map(k=>[k,new THREE.Color(lighting[theme][k])])) as Record<typeof colorKeys[number],THREE.Color>;
 const fromColors=Object.fromEntries(colorKeys.map(k=>[k,colors[k].clone()])) as typeof colors;
 const targetColors=Object.fromEntries((['dark','light'] as const).map(name=>[name,Object.fromEntries(colorKeys.map(k=>[k,new THREE.Color(lighting[name][k])]))])) as Record<LightingTheme,typeof colors>;
 const values=Object.fromEntries(scalarKeys.map(k=>[k,lighting[theme][k]])) as Record<typeof scalarKeys[number],number>,fromValues={...values};
 const applyTheme=(now:number,immediate=false)=>{
  const progress=immediate?1:Math.min(1,Math.max(0,(now-themeStarted)/landingMotion.themeMs)),ease=progress*progress*(3-2*progress),target=lighting[theme];
  for(const k of colorKeys)colors[k].copy(fromColors[k]).lerp(targetColors[theme][k],ease);
  for(const k of scalarKeys)values[k]=THREE.MathUtils.lerp(fromValues[k],target[k],ease);
  material.color.copy(colors.material);material.metalness=values.metalness;material.roughness=values.roughness;material.clearcoat=values.clearcoat;material.iridescence=values.iridescence;material.envMapIntensity=values.environment;
  ambient.color.copy(colors.sky);ambient.groundColor.copy(colors.ground);ambient.intensity=values.ambient;
  keyLight.color.copy(colors.key);keyLight.intensity=values.keyPower;rimLight.color.copy(colors.rim);rimLight.intensity=values.rimPower;fillLight.color.copy(colors.fill);fillLight.intensity=values.fillPower;
  nodeMaterial.color.copy(colors.node);nodeMaterial.emissive.copy(colors.emissive);edgeMaterial.color.copy(colors.edge);pulseColor.value.copy(colors.pulse);renderer.toneMappingExposure=values.exposure;
  const state=progress===1?'settled':'transitioning';if(host.dataset.themeBlend!==state)host.dataset.themeBlend=state;
 };
 host.dataset.lightingTheme=theme;applyTheme(performance.now(),true);
 const resize=()=>{const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;camera.aspect=width/height;const halfFov=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect));fitDistance=2.15/Math.sin(halfFov)*1.05;camera.position.set(0,0,fitDistance*(.72+opening*.16));camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);draw();};
 const draw=()=>{if(contextLost||dead||!visible||document.hidden||!loaded)return;renderer.render(scene,camera);host.dataset.rendered='true';};
 const resetEnergy=()=>{hero.style.removeProperty('--neural-energy');lastEnergyAt=0;};
 const tick=(now:number)=>{
  frame=0;if(contextLost||failed||dead||!visible||document.hidden||motion.matches)return;
  const delta=last?Math.min((now-last)/1000,.05):0;last=now;elapsed+=delta;const ease=1-Math.exp(-delta*landingMotion.springResponse);x+=(targetX-x)*ease;y+=(targetY-y)*ease;
  const target=host.dataset.expanded==='true'?1:0;articulate(opening+(target-opening)*(1-Math.exp(-delta*4)));
  group.rotation.set(-.16+Math.sin(elapsed*.22)*.035+y*.1,.55+Math.sin(elapsed*.075)*.32+x*.2,Math.sin(elapsed*.17)*.015);group.position.y=Math.sin(elapsed*.6)*.06;
  pulseTime.value=elapsed;pulseMotion.value=1;applyTheme(now);draw();
  if(now-lastEnergyAt>=200){hero.style.setProperty('--neural-energy',String(.5+.5*Math.sin(elapsed*Math.PI*.18)));lastEnergyAt=now;}
  if(delta>0){frameCost+=delta*1000;frames++;if(frames>=90){if(frameCost/frames>24&&dpr>.75){dpr=Math.max(.75,dpr*.8);renderer.setPixelRatio(dpr);}frames=0;frameCost=0;}}
  frame=requestAnimationFrame(tick);
 };
 const sync=()=>{
  cancelAnimationFrame(frame);frame=0;last=0;
  if(!contextLost&&!failed&&!dead&&visible&&!document.hidden){
   if(motion.matches){group.rotation.set(-.16,.55,0);group.position.y=0;pulseMotion.value=0;applyTheme(performance.now(),true);resetEnergy();articulate(host.dataset.expanded==='true'?1:0);draw();}
   else frame=requestAnimationFrame(tick);
  }else resetEnergy();
 };
 const changeTheme=()=>{
  const next:LightingTheme=document.documentElement.dataset.theme==='light'?'light':'dark';if(next===theme)return;
  applyTheme(performance.now(),motion.matches);for(const k of colorKeys)fromColors[k].copy(colors[k]);for(const k of scalarKeys)fromValues[k]=values[k];
  theme=next;themeStarted=performance.now();host.dataset.lightingTheme=theme;host.dataset.themeBlend=motion.matches?'settled':'transitioning';
  if(motion.matches){applyTheme(themeStarted,true);draw();}else if(!contextLost&&!frame&&visible&&!document.hidden&&!failed&&!dead)frame=requestAnimationFrame(tick);
 };
 const themes=new MutationObserver(changeTheme);themes.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const move=(event:Event)=>{const e=event as PointerEvent;if(!fine.matches||motion.matches||e.pointerType==='touch')return;const box=hero.getBoundingClientRect();targetX=Math.max(-1,Math.min(1,(e.clientX-box.left)/box.width*2-1));targetY=Math.max(-1,Math.min(1,(e.clientY-box.top)/box.height*2-1));};
 const leave=()=>{targetX=0;targetY=0;};
 const lost=(event:Event)=>{event.preventDefault();contextLost=true;delete host.dataset.rendered;sync();};
 const restored=()=>{contextLost=false;resize();sync();};
 const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;sync();});observer.observe(host);
 const size=new ResizeObserver(resize);size.observe(host);hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);host.addEventListener('sculpture:expand',sync);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);resize();sync();

 void fetch('/stitch/anatomical-brain.glb',{signal:modelRequest.signal}).then(response=>{if(!response.ok)throw new Error('Brain asset unavailable');return response.arrayBuffer();}).then(buffer=>loader.parseAsync(buffer,'/stitch/')).then(gltf=>{
  if(dead){releaseSource(gltf.scene);return;}
  gltf.scene.updateMatrixWorld(true);const geometries:THREE.BufferGeometry[]=[],pulseSources:THREE.BufferGeometry[]=[];
  gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){
   // GLTFLoader puts extras on the anatomical parent Group when a source mesh
   // has multiple primitives. Its child meshes do not inherit those extras.
   let anatomy:THREE.Object3D|null=o;while(anatomy&&!anatomy.userData.bx_cat)anatomy=anatomy.parent;
   const label=anatomy?.userData.bx_label||anatomy?.name||o.name;
   if(pulseSources.length<6&&anatomy?.userData.bx_cat==='cortex'&&/superior.?frontal|precentral.?gyrus|middle.?temporal/i.test(label))pulseSources.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
   let geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geometry.index){const expanded=geometry.toNonIndexed();geometry.dispose();geometry=expanded;}for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);geometries.push(geometry);
  }});
  const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());releaseSource(gltf.scene);if(!merged){pulseSources.forEach(g=>g.dispose());throw new Error('Anatomical model could not be assembled.');}
  merged.computeBoundingBox();const box=merged.boundingBox!,center=box.getCenter(new THREE.Vector3()),radius=box.getBoundingSphere(new THREE.Sphere()).radius,scale=1.65/radius;
  const normalize=(geometry:THREE.BufferGeometry)=>geometry.translate(-center.x,-center.y,-center.z).scale(scale,scale,scale).rotateY(Math.PI);
  normalize(merged);merged.computeBoundingSphere();brainGeometry=merged;group.add(new THREE.Mesh(merged,material));
  host.dataset.surfaceSources=String(pulseSources.length);
  for(const source of pulseSources){normalize(source);const points=pathGeometries.length<3?corticalPath(source):[];source.dispose();if(points.length<5)continue;
   const geometry=new THREE.BufferGeometry().setFromPoints(points),distances=[0];let length=0;for(let i=1;i<points.length;i++){length+=points[i].distanceTo(points[i-1]);distances.push(length);}
   geometry.setAttribute('pathProgress',new THREE.Float32BufferAttribute(distances.map(d=>d/(length||1)),1));pathGeometries.push(geometry);const path=new THREE.Line(geometry,pathMaterial);path.renderOrder=1;group.add(path);
  }
  const positions=merged.attributes.position;nodes.forEach(({base})=>{let best=Infinity;const target=base.clone(),candidate=new THREE.Vector3();for(let v=0;v<positions.count;v+=3){candidate.fromBufferAttribute(positions,v);const score=candidate.distanceToSquared(target);if(score<best){best=score;base.copy(candidate);}}});
  loaded=true;host.dataset.anatomy='loaded';host.dataset.surfacePaths=String(pathGeometries.length);resize();sync();decoder.dispose();
 }).catch(()=>{failed=true;cancelAnimationFrame(frame);decoder.dispose();delete host.dataset.rendered;resetEnergy();});

 return()=>{
  dead=true;modelRequest.abort();cancelAnimationFrame(frame);observer.disconnect();size.disconnect();themes.disconnect();hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);host.removeEventListener('sculpture:expand',sync);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
  brainGeometry?.dispose();pathGeometries.forEach(g=>g.dispose());pathMaterial.dispose();decoder.dispose();nodeGeometry.dispose();nodeMaterial.dispose();edgeGeometry.dispose();edgeMaterial.dispose();material.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();resetEnergy();
  delete host.dataset.rendered;delete host.dataset.networkState;delete host.dataset.anatomy;delete host.dataset.lightingTheme;delete host.dataset.themeBlend;delete host.dataset.surfacePaths;delete host.dataset.surfaceSources;
 };
}
