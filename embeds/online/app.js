const $=id=>document.getElementById(id);
const master=$('input-video'),rgb=$('rgb-video'),pca=$('pca-video'),videos=[master,rgb,pca];
const debug=window.onlineDebug={scene:null,mode:'rgb',playing:false,autoMode:true};
let active,ticket=0,wanted=true,visible=true,parentVisible=true,autoMode=true,seeking=false,buffering=false;
const parentOrigins=new Set([location.origin]);
const fmt=s=>`${Math.floor((s||0)/60)}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
function height(){if(parent!==window)parent.postMessage({type:'l3g-online-height',height:Math.ceil($('online-reconstruction').getBoundingClientRect().height+4)},'*');}
new ResizeObserver(height).observe($('online-reconstruction'));
function status(text='',error=false){$('status').textContent=text;$('status').classList.toggle('error',error);height();}
function setMode(mode){debug.mode=mode;$('rendering').classList.toggle('vae',mode==='vae');$('rendering').classList.toggle('half',mode==='half');document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
function update(){
 const t=master.currentTime||0,d=master.duration||0;
 if(!seeking)$('seek').value=d?t/d:0;$('time').textContent=`${fmt(t)} / ${fmt(d)}`;
 if(autoMode)setMode(['rgb','vae','half'][Math.floor(t/2)%3]);
 for(const v of [rgb,pca]){if(v.readyState>=2&&!v.seeking&&Math.abs(v.currentTime-t)>.06)v.currentTime=t;}
 debug.times=videos.map(v=>v.currentTime);debug.playing=!master.paused;debug.frames=Number(debug.frames||0)+1;
}
async function playback(){
 const run=wanted&&visible&&parentVisible&&!document.hidden&&!seeking&&!buffering;
 $('play').textContent=wanted?'Ⅱ':'▶';$('play').setAttribute('aria-label',wanted?'Pause synchronized videos':'Play synchronized videos');
 if(!run){videos.forEach(v=>v.pause());return;}
 if(videos.some(v=>v.readyState<3)){videos.forEach(v=>v.pause());return;}
 const results=await Promise.allSettled(videos.map(v=>v.play()));
 if(results.some(r=>r.status==='rejected'&&r.reason?.name==='NotAllowedError')){wanted=false;videos.forEach(v=>v.pause());$('play').textContent='▶';status('Press play to start.');}
}
function frame(){update();if(master.requestVideoFrameCallback)master.requestVideoFrameCallback(frame);else requestAnimationFrame(frame);}
if(master.requestVideoFrameCallback)master.requestVideoFrameCallback(frame);else requestAnimationFrame(frame);
function bufferState(){buffering=videos.some(v=>v.readyState<3);if(!buffering){status();playback();}}
videos.forEach(v=>{
 v.addEventListener('canplay',bufferState);v.addEventListener('seeked',()=>{update();bufferState();});
 v.addEventListener('waiting',()=>{if(!seeking){buffering=true;videos.forEach(x=>x.pause());status('Buffering videos…');}});
 v.addEventListener('error',()=>status('This video could not be loaded. Reload the page to retry.',true));
});
master.addEventListener('ended',()=>{videos.forEach(v=>v.currentTime=0);buffering=false;playback();});
master.addEventListener('loadedmetadata',update);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{autoMode=false;debug.autoMode=false;setMode(b.dataset.mode);}));
$('play').addEventListener('click',()=>{wanted=!wanted;playback();});
$('seek').addEventListener('input',()=>{seeking=true;videos.forEach(v=>v.pause());const t=Number($('seek').value)*(master.duration||0);videos.forEach(v=>{if(v.readyState>=1)v.currentTime=Math.min(t,Math.max(0,v.duration-.001));});update();});
$('seek').addEventListener('change',()=>{seeking=false;bufferState();playback();});
document.addEventListener('visibilitychange',playback);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;playback();},{threshold:.01}).observe($('online-reconstruction'));
window.addEventListener('message',e=>{if(e.source===parent&&parentOrigins.has(e.origin)&&e.data?.type==='l3g-online-visibility'){parentVisible=Boolean(e.data.visible);if(Number.isFinite(e.data.thumbnailWidth))document.documentElement.style.setProperty('--scene-thumb-size',e.data.thumbnailWidth+'px');playback();}});
async function select(s){
 if(active?.id===s.id)return;
 ++ticket;active=s;debug.scene=s.id;wanted=true;buffering=true;autoMode=true;debug.autoMode=true;setMode('rgb');
 document.querySelectorAll('.scene-thumb').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===s.id)));
 status('Loading videos…');
 for(const [v,key] of [[master,'input_video'],[rgb,'rgb_video'],[pca,'pca_video']]){v.pause();v.src=s[key];v.poster=s[key.replace('_video','_poster')]||s.poster;v.load();}
 $('seek').value=0;debug.frame_count=s.frame_count;debug.fps=s.fps;
}
try{
 const r=await fetch('assets/manifest.json');if(!r.ok)throw Error('Scene list unavailable');const m=await r.json();
 for(const [i,s]of m.scenes.entries()){const b=document.createElement('button');b.className='scene-thumb';b.dataset.id=s.id;b.setAttribute('aria-label',`View online reconstruction ${i+1}`);b.setAttribute('aria-pressed','false');const img=document.createElement('img');img.src=s.poster;img.alt='';img.loading='lazy';b.append(img);b.addEventListener('click',()=>select(s));$('scene-picker').append(b);}
 await select(m.scenes[0]);height();
}catch(e){status(`Could not load reconstruction videos. ${e.message}`,true);}
