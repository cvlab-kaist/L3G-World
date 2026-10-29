import {loadSplat} from './splat-loader.js';
const $ = id => document.getElementById(id);
const debug = window.reconstructionDebug = {loaded:false,auto:false};
let manifest,active,viewer,viewerPromise,generation=0,controller,loadTimer,autoTime=0;
let autoMotion=!matchMedia('(prefers-reduced-motion: reduce)').matches,visible=true,parentVisible=true;
const keys=new Set();
const parentOrigins=new Set([location.origin]);
function notifyHeight(){if(parent!==window)parent.postMessage({type:'l3g-reconstruction-height',height:Math.ceil($('reconstruction').getBoundingClientRect().height+4)},'*');}
new ResizeObserver(notifyHeight).observe($('reconstruction'));
window.addEventListener('message',e=>{if(e.source===parent&&parentOrigins.has(e.origin)&&e.data?.type==='l3g-reconstruction-visibility'){parentVisible=Boolean(e.data.visible);if(Number.isFinite(e.data.thumbnailWidth))document.documentElement.style.setProperty('--scene-thumb-size',e.data.thumbnailWidth+'px');if(!parentVisible)keys.clear();}});
function message(text,error=false){$('viewer-message').hidden=false;$('viewer-message').classList.toggle('error',error);$('load-label').textContent=text;$('retry').hidden=!error;$('load-progress').hidden=error;}
function stopAuto(){autoMotion=false;debug.auto=false;}
function projection(c){
 if(!viewer)return;const {camera}=viewer,w=$('viewport').clientWidth||832,h=$('viewport').clientHeight||480;
 camera.aspect=w/h;camera.near=c.near||.01;camera.far=c.far||10000;camera.fov=c.fov_y_degrees||60;
 if(c.intrinsics){const [iw,ih]=c.source_resolution||[832,480],K=c.intrinsics,vw=ih*w/h,cx=K[0][2]+(vw-iw)/2;
  camera.projectionMatrix.makePerspective(-cx/K[0][0]*camera.near,(vw-cx)/K[0][0]*camera.near,K[1][2]/K[1][1]*camera.near,-(ih-K[1][2])/K[1][1]*camera.near,camera.near,camera.far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 }else camera.updateProjectionMatrix();
}
function reset(){
 if(!viewer||!active)return;const {THREE,camera}=viewer,c=active.camera;
 new THREE.Matrix4().fromArray(c.matrix).decompose(camera.position,camera.quaternion,camera.scale);camera.scale.set(1,1,1);camera.up.fromArray(c.up||[0,-1,0]);camera.updateMatrixWorld(true);projection(c);
 viewer.home={position:camera.position.clone(),rotation:camera.quaternion.clone(),target:new THREE.Vector3().fromArray(c.target),up:camera.up.clone(),right:new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion)};
 keys.clear();autoTime=0;autoMotion=!matchMedia('(prefers-reduced-motion: reduce)').matches;debug.auto=autoMotion;
}
function rotate(yaw,pitch){const {THREE,camera}=viewer;camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(viewer.home.up,yaw));camera.rotateX(pitch);camera.updateMatrixWorld();}
async function createViewer(){
 const [THREE,{SparkRenderer,SplatMesh}]=await Promise.all([import('three'),import('@sparkjsdev/spark')]);
 const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Explore the generated 3D scene');$('viewport').prepend(canvas);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);const camera=new THREE.PerspectiveCamera(60,832/480,.01,10000);
 const spark=new SparkRenderer({renderer,preBlurAmount:0,blurAmount:.3,sortRadial:false,enableLod:false});scene.add(spark);
 viewer={THREE,SplatMesh,renderer,scene,camera,spark,mesh:null,home:null};
 new ResizeObserver(()=>{renderer.setSize($('viewport').clientWidth,$('viewport').clientHeight,false);if(active)projection(active.camera);}).observe($('viewport'));
 let drag=null;
 canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});stopAuto();drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===2};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
  if(drag.pan){const s=(active.camera.scene_scale||1)*.002;camera.translateX(-dx*s);camera.translateY(dy*s);}else rotate(-dx*.003,-dy*.003);
 });
 const end=e=>{if(drag?.id===e.pointerId)drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{e.preventDefault();stopAuto();camera.translateZ(e.deltaY*(active.camera.scene_scale||1)*.001);},{passive:false});
 const used=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight'];
 canvas.addEventListener('keydown',e=>{if(used.includes(e.code)){e.preventDefault();stopAuto();keys.add(e.code);}});canvas.addEventListener('keyup',e=>keys.delete(e.code));canvas.addEventListener('blur',()=>keys.clear());window.addEventListener('blur',()=>keys.clear());
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopAuto();debug.contextLost=true;message('The browser paused 3D graphics. Reload this viewer to continue.',true);});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe($('viewport'));
 let last=performance.now(),drawn=0;
 renderer.setAnimationLoop(now=>{
  if(document.hidden||!visible||!parentVisible||!viewer.mesh){last=now;return;}
  if(now-drawn<32)return;
  const dt=Math.min((now-last)/1000,.05);last=now;drawn=now;
  if(autoMotion&&viewer.home){
   autoTime+=dt;const h=viewer.home,angle=autoTime*Math.PI/3;
   const offset=h.position.clone().sub(h.target);offset.applyAxisAngle(h.up,.035*Math.sin(angle));offset.applyAxisAngle(h.right,.012*Math.sin(2*angle));
   camera.position.copy(h.target).add(offset);camera.up.copy(h.up);camera.lookAt(h.target);
  }else if(keys.size){const speed=(active.camera.scene_scale||1)*.3*dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1);
   camera.translateX((Number(keys.has('KeyD'))-Number(keys.has('KeyA')))*speed);camera.translateZ((Number(keys.has('KeyS'))-Number(keys.has('KeyW')))*speed);
   camera.position.addScaledVector(viewer.home.up,(Number(keys.has('KeyE'))-Number(keys.has('KeyQ')))*speed);
   rotate((Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt,(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt);
  }
  renderer.render(scene,camera);debug.renderFrames=(debug.renderFrames||0)+1;debug.camera=camera.matrixWorld.elements.slice();debug.auto=autoMotion;
 });return viewer;
}
async function fetchBuffer(s,signal,ticket){return loadSplat(s,signal,(n,total)=>{if(ticket===generation&&!signal.aborted){$('load-progress').value=n/total;$('load-label').textContent=`Loading 3D scene · ${Math.round(n/total*100)}%`;}});}
async function loadScene(s){
 const ticket=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal;
 clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(ticket===generation){controller.abort();message('Loading took too long. Please check your connection and retry.',true);}},240000);
 stopAuto();keys.clear();debug.loaded=false;debug.scene=s.id;delete debug.error;
 if(viewer?.mesh){viewer.scene.remove(viewer.mesh);viewer.mesh.dispose();viewer.mesh=null;}
 message('Loading 3D scene…');$('load-progress').value=0;
 try{
  viewerPromise ||= createViewer().catch(e=>{viewerPromise=null;throw e;});
  const [v,bytes]=await Promise.all([viewerPromise,fetchBuffer(s,signal,ticket)]);if(ticket!==generation||signal.aborted)return;
  $('load-label').textContent='Preparing 3D scene…';const mesh=new v.SplatMesh({fileBytes:bytes,fileName:s.splat_name||s.splat,extSplats:true,lod:false,enableLod:false});await mesh.initialized;
  if(ticket!==generation||signal.aborted){mesh.dispose();return;}mesh.maxSh=3;v.mesh=mesh;v.scene.add(mesh);reset();clearTimeout(loadTimer);$('viewer-message').hidden=true;debug.loaded=true;debug.count=mesh.numSplats;debug.maxSh=mesh.maxSh;
  v.renderer.render(v.scene,v.camera);
 }catch(e){if(ticket!==generation||e.name==='AbortError')return;controller.abort();clearTimeout(loadTimer);debug.error=e.message;message(/webgl|context/i.test(e.message)?'WebGL2 is unavailable. Enable hardware acceleration or try another browser.':`Could not load the 3D scene. ${e.message}`,true);}
}
function selectScene(s){if(active?.id===s.id)return;active=s;$('input-count').textContent=`This scene was generated from ${s.input_count} input image${s.input_count===1?'':'s'}.`;
 document.querySelectorAll('.scene-thumb').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===s.id)));loadScene(s);
}
$('reset-view').addEventListener('click',reset);$('retry').addEventListener('click',()=>{if(debug.contextLost)location.reload();else loadScene(active);});
try{
 const r=await fetch('assets/embed-scenes.json');if(!r.ok)throw new Error('Scene list unavailable');manifest=await r.json();
 for(const [i,s] of manifest.scenes.entries()){const b=document.createElement('button');b.className='scene-thumb';b.dataset.id=s.id;b.setAttribute('aria-label',`Explore scene ${i+1}`);b.setAttribute('aria-pressed','false');const image=document.createElement('img');image.src=s.poster;image.alt='';image.loading='lazy';b.append(image);b.addEventListener('click',()=>selectScene(s));$('scene-picker').append(b);}
 selectScene(manifest.scenes[0]);notifyHeight();
}catch(e){message(`Could not load scenes. ${e.message}`,true);}
