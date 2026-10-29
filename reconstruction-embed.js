for(const [id,prefix] of [['reconstruction-viewer','l3g-reconstruction'],['online-reconstruction-viewer','l3g-online']]){
 const frame=document.getElementById(id);if(!frame)continue;const origin=new URL(frame.src).origin;let visible=false;
 const send=()=>{const thumb=document.querySelector('#all-galleries .scene-thumb');frame.contentWindow?.postMessage({type:prefix+'-visibility',visible:visible&&!document.hidden,thumbnailWidth:thumb?.getBoundingClientRect().width},origin);};
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;send();},{threshold:.03}).observe(frame);
 window.addEventListener('resize',send);frame.addEventListener('load',send);document.addEventListener('visibilitychange',send);
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==origin||event.data?.type!==prefix+'-height')return;const h=Number(event.data.height);if(Number.isFinite(h)&&h>=200&&h<=1600)frame.style.height=Math.ceil(h)+'px';});
}
