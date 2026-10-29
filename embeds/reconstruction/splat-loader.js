// Full-count SPZ assets are split only for transport. Reassemble the original
// bytes, verify their hashes, then let Spark decode one complete scene.
export async function loadSplat(scene,signal,onProgress=()=>{}){
 if(!scene.asset_bridge){
  const r=await fetch(scene.splat,{signal});if(!r.ok)throw Error(`Scene download returned HTTP ${r.status}`);
  const total=Number(r.headers.get('content-length'))||scene.bytes,parts=[];let n=0;
  if(!r.body)return r.arrayBuffer();const reader=r.body.getReader();
  while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);n+=value.byteLength;onProgress(n,total);}
  const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.byteLength;}return out.buffer;
 }
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const bridge=new URL(scene.asset_bridge),requestId=crypto.randomUUID(),parts=scene.assetparts;
 if(!Array.isArray(parts)||!parts.length||parts.reduce((n,p)=>n+p.bytes,0)!==scene.bytes)throw Error('Invalid scene transport manifest');
 const iframe=document.createElement('iframe');iframe.hidden=true;iframe.src=bridge.href;iframe.title='3D scene asset loader';
 const out=new Uint8Array(scene.bytes);let received=0,next=0,settled=false;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{window.removeEventListener('message',message);signal.removeEventListener('abort',abort);iframe.remove();};
  const fail=e=>{if(settled)return;settled=true;cleanup();reject(e);};
  const abort=()=>fail(new DOMException('Aborted','AbortError'));
  async function message(e){
   if(e.source!==iframe.contentWindow||e.origin!==bridge.origin||e.data?.requestId!==requestId||settled)return;
   const m=e.data;
   if(m.type==='progress'){onProgress(received+Math.min(Number(m.bytes)||0,parts[next]?.bytes||0),scene.bytes);return;}
   if(m.type==='error'){fail(Error(m.message||'Scene download failed'));return;}
   if(m.type!=='part'||m.index!==next||!(m.buffer instanceof ArrayBuffer))return;
   const spec=parts[next];
   if(m.buffer.byteLength!==spec.bytes){fail(Error('Incomplete 3D scene download'));return;}
   try{
    const digest=await crypto.subtle.digest('SHA-256',m.buffer);
    const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==spec.sha256)throw Error('Scene integrity check failed; please retry.');
    if(settled)return;out.set(new Uint8Array(m.buffer),received);received+=m.buffer.byteLength;next++;onProgress(received,scene.bytes);
    if(next===parts.length){
     const digest=await crypto.subtle.digest('SHA-256',out);const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
     if(hash!==scene.splat_sha256)throw Error('Scene integrity check failed; please retry.');
     if(settled)return;settled=true;cleanup();resolve(out.buffer);
    }else iframe.contentWindow.postMessage({type:'next',requestId,index:next},bridge.origin);
   }catch(err){fail(err);}
  }
  signal.addEventListener('abort',abort,{once:true});window.addEventListener('message',message);
  iframe.addEventListener('load',()=>{if(!settled)iframe.contentWindow.postMessage({type:'load',requestId,paths:parts.map(p=>p.path)},bridge.origin);},{once:true});
  iframe.addEventListener('error',()=>fail(Error('Scene asset server is unavailable.')),{once:true});
  document.body.append(iframe);
 });
}
