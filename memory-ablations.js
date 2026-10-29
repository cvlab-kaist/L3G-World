/* A single decoded camera trajectory drives all three crops and the graph. */
(() => {
  const root = document.getElementById('memory-ablation-gallery');
  if (!root) return;
  const debug = window.memoryAblationDebug = {};
  const labels = ['L3G-Mem (Full)', 'Without Memory Refinement', 'Without Adaptive Spawn'];
  const colors = ['#168f87', '#687b88', '#a5aaaf'];
  let scene, selections, visible = false, userPaused = false;
  let seeking = false, seekResume = false, presentedFrame = null;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const picker = el('div', 'ablation-picker'); picker.setAttribute('aria-label', 'Reconstruction ablation scene');
  const stage = el('div', 'ablation-stage'), outputs = el('div', 'ablation-outputs');
  const canvases = labels.map(label => {
    const f = el('figure', 'ablation-output'), c = el('canvas'); c.width = 832; c.height = 480;
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', label + ' reconstruction');
    f.append(el('figcaption', '', label), c); outputs.append(f); return c;
  });
  const video = el('video'); video.muted = true; video.playsInline = true; video.preload = 'metadata'; video.hidden = true;
  const bar = el('div', 'ablation-transport'), play = el('button', '', 'Ⅱ'), seek = el('input'), time = el('output');
  play.type = 'button'; play.setAttribute('aria-label', 'Pause reconstruction comparison');
  seek.type = 'range'; seek.min = 0; seek.step = 1; seek.value = 0; seek.setAttribute('aria-label', 'Reconstruction comparison frame');
  bar.append(play, seek, time);
  const graph = el('canvas', 'ablation-growth'); graph.setAttribute('role', 'img'); graph.setAttribute('aria-label', 'Synchronized Gaussian memory growth for three variants');
  const legend = el('div', 'ablation-legend');
  labels.forEach((label, i) => { const n = el('span', '', label); n.style.setProperty('--series', colors[i]); legend.append(n); });
  const status = el('p', 'ablation-status'); status.setAttribute('role', 'status');
  stage.append(outputs, bar, legend, graph, status, video); root.replaceChildren(picker, stage);

  const currentFrame = () => Math.max(0, Math.min((scene?.frame_count || 1)-1, presentedFrame ?? Math.floor(video.currentTime*(scene?.fps || 24)+.01)));
  const ranges = () => selections?.scenes?.[scene?.id]?.ranges || [];
  function updateButton() { play.textContent = userPaused ? '▶' : 'Ⅱ'; play.setAttribute('aria-label', (userPaused?'Play':'Pause')+' reconstruction comparison'); }
  function maybePlay() { if (visible && !document.hidden && !userPaused && !seeking) video.play().catch(() => {}); }
  function setFrame(frame) { presentedFrame=null; video.currentTime = (Math.min(scene.frame_count-1,Math.max(0,frame))+.05)/scene.fps; }
  function growth(frame) {
    if (!scene) return;
    const width = Math.max(400,graph.clientWidth), height = Math.max(210,graph.clientHeight), scale = Math.min(devicePixelRatio,2);
    if (graph.width !== Math.round(width*scale) || graph.height !== Math.round(height*scale)) { graph.width = Math.round(width*scale); graph.height = Math.round(height*scale); }
    const ctx = graph.getContext('2d'); ctx.setTransform(scale,0,0,scale,0,0); ctx.clearRect(0,0,width,height);
    const m = {left:55,right:24,top:35,bottom:42}, pw=width-m.left-m.right, ph=height-m.top-m.bottom;
    const end=scene.growth.cutoff_frame, at=Math.min(frame,end), max=Math.ceil(Math.max(...scene.growth.series.flatMap(s=>s.anchors.map(a=>a.primitives_k)))/50)*50;
    const x=f=>m.left+f/end*pw, y=v=>m.top+ph-v/max*ph;
    ctx.font='13px Inter, Arial, sans-serif'; ctx.fillStyle='#617a6b'; ctx.fillText('Gaussians (K)',m.left,18);
    ctx.lineWidth=1; ctx.setLineDash([]);
    for(let i=0;i<=4;i++){const val=max*i/4;ctx.strokeStyle='#edf0f0';ctx.beginPath();ctx.moveTo(m.left,y(val));ctx.lineTo(width-m.right,y(val));ctx.stroke();ctx.textAlign='right';ctx.fillText(String(Math.round(val)),m.left-10,y(val)+4);}
    ctx.textAlign='center';
    for(let i=0;i<=4;i++){const f=end*i/4;ctx.fillText((f/scene.fps).toFixed(i?1:0),x(f),height-23);}
    ctx.fillText('Video Time (s)',m.left+pw/2,height-4);
    scene.growth.series.forEach((s,i)=>{
      const anchors=s.anchors.filter(a=>a.frame<=at).map(a=>({frame:a.frame,value:a.primitives_k}));
      const next=s.anchors.find(a=>a.frame>at), last=anchors.at(-1);
      if(next&&last&&last.frame<at)anchors.push({frame:at,value:last.value+(next.primitives_k-last.value)*(at-last.frame)/(next.frame-last.frame)});
      ctx.strokeStyle=colors[i];ctx.lineWidth=i===0?3:2.4;ctx.setLineDash(i===1?[7,5]:i===2?[2,5]:[]);ctx.beginPath();
      anchors.forEach((a,j)=>j?ctx.lineTo(x(a.frame),y(a.value)):ctx.moveTo(x(a.frame),y(a.value)));ctx.stroke();
    });
    ctx.setLineDash([3,4]);ctx.strokeStyle='#b8c9c0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(at),m.top);ctx.lineTo(x(at),m.top+ph);ctx.stroke();ctx.setLineDash([]);
    debug.graphFrame=at;
  }
  function draw() {
    if (!scene) return;
    const frame=currentFrame(), activeRanges=ranges().filter(r=>r.start_frame<=frame && frame<=r.end_frame);
    const boxes=activeRanges.flatMap(r=>r.boxes);
    if (video.readyState>=2) canvases.forEach((c,i)=>{
      const ctx=c.getContext('2d'), crop=scene.variants[i].crop;
      ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,c.width,c.height);
      for(const b of boxes){ctx.strokeStyle='#ff303b';ctx.lineWidth=4;ctx.strokeRect(b.x*c.width,b.y*c.height,b.w*c.width,b.h*c.height);}
    });
    seek.value=frame; time.value=`${(frame/scene.fps).toFixed(1)} / ${(scene.frame_count/scene.fps).toFixed(1)} s`;
    growth(video.currentTime*scene.fps);debug.frame=frame;debug.scene=scene.id;debug.playbackRate=video.playbackRate;debug.activeRanges=activeRanges.length;debug.boxes=boxes;
  }
  function animate() {
    if (scene && visible && !document.hidden) draw();
    requestAnimationFrame(animate);
  }
  async function select(s) {
    if(scene?.id===s.id)return;scene=s;presentedFrame=null;video.pause();video.playbackRate=1;userPaused=false;seeking=false;
    picker.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===s.id)));
    seek.max=s.frame_count-1;video.src=s.video;video.load();status.classList.remove('error');status.textContent='Loading reconstruction…';updateButton();draw();
  }
  play.addEventListener('click',()=>{userPaused=!userPaused;if(userPaused)video.pause();else maybePlay();updateButton();draw();});
  function startSeek(){if(seeking)return;seekResume=!userPaused;seeking=true;video.pause();}
  seek.addEventListener('pointerdown',startSeek);
  seek.addEventListener('input',()=>{startSeek();const frame=Number(seek.value);setFrame(frame);growth(frame);});
  seek.addEventListener('change',()=>{seeking=false;userPaused=!seekResume;updateButton();maybePlay();});
  video.addEventListener('seeked',()=>{presentedFrame=null;draw();});
  if(video.requestVideoFrameCallback){
    const presented=(now,meta)=>{if(scene&&!video.seeking){presentedFrame=Math.floor(meta.mediaTime*scene.fps+.001);if(visible&&!document.hidden)draw();}video.requestVideoFrameCallback(presented);};
    video.requestVideoFrameCallback(presented);
  }
  video.addEventListener('loadeddata',()=>{status.textContent='';draw();maybePlay();});
  video.addEventListener('error',()=>{status.classList.add('error');status.textContent='Could not load the comparison video. Reload the page to retry.';});
  video.addEventListener('ended',()=>{presentedFrame=null;video.currentTime=0;maybePlay();});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)maybePlay();else{video.pause();}},{threshold:.04}).observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();}else maybePlay();});
  new ResizeObserver(draw).observe(graph);
  Promise.all([fetch('assets/data/memory_ablation_media.json').then(r=>{if(!r.ok)throw Error('Scene list unavailable');return r.json();}),fetch('assets/data/memory_ablation_ranges.json').then(r=>r.ok?r.json():{scenes:{}})])
    .then(([manifest,annotations])=>{selections=annotations;manifest.scenes.forEach(s=>{const b=el('button','',s.id==='sample_03'?'Scene 1':'Scene 2');b.type='button';b.dataset.scene=s.id;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>select(s));picker.append(b);});select(manifest.scenes[0]);requestAnimationFrame(animate);debug.ready=true;})
    .catch(e=>{status.classList.add('error');status.textContent=e.message;});
})();
