// A shared source-frame timeline: shorter clips hold, and all clips loop together.
export function createGroupPlayer(items, {sourceFps, onFrame=()=>{}, onCycle=()=>{}, onState=()=>{}, onError=()=>{}, requestFrame=requestAnimationFrame, cancelFrame=cancelAnimationFrame}) {
 const totalFrames=Math.max(...items.map(x=>x.frames));
 const master=items.find(x=>x.frames===totalFrames);
 let frame=0, playing=false, generation=0, raf=0, completePass=false;
 const point=(x,f)=>Math.min(Math.max(f,0),x.frames-1+.1)/x.fps;
 function display(f){frame=Math.max(0,Math.min(f,totalFrames-1));onFrame(frame);}
 function pause(){generation++;playing=false;cancelFrame(raf);items.forEach(x=>x.el.pause());onState(false);}
 function seek(f){pause();display(f);for(const x of items)x.el.currentTime=point(x,frame);}
 function seekAll(f,token){return Promise.all(items.map(x=>new Promise(resolve=>{
  const el=x.el,target=point(x,f);let timer;
  const done=()=>{clearTimeout(timer);el.removeEventListener('seeked',done);el.removeEventListener('error',done);resolve();};
  if(token!==generation)return resolve();
  if(Math.abs(el.currentTime-target)<.0001&&!el.seeking)return resolve();
  el.addEventListener('seeked',done);el.addEventListener('error',done);
  timer=setTimeout(done,5000);el.currentTime=target;
 })));}
 async function startPass(token,f){
  items.forEach(x=>x.el.pause());await seekAll(f,token);
  if(token!==generation||!playing)return;
  display(f);completePass=f<1;
  try{await Promise.all(items.filter(x=>f<x.frames).map(x=>{x.el.loop=false;x.el.playbackRate=sourceFps/x.fps;return x.el.play();}));}
  catch(e){if(token===generation){pause();onError(e);}return;}
  if(token!==generation||!playing)return;
  const tick=()=>{
   if(token!==generation||!playing)return;
   const f=master.el.currentTime*master.fps;
   if(master.el.ended){
    display(totalFrames-1);items.forEach(x=>x.el.pause());
    onCycle({complete:completePass});
    if(token===generation&&playing)void startPass(token,0);
    return;
   }
   for(const x of items){
    if(x===master)continue;
    if(f>=x.frames){
     x.el.pause();const end=point(x,x.frames);
     if(Math.abs(x.el.currentTime-end)*x.fps>.25)x.el.currentTime=end;
    }else{
     const target=f/x.fps;
     if(Math.abs(x.el.currentTime-target)*x.fps>1)x.el.currentTime=target;
    }
   }
   display(f);raf=requestFrame(tick);
  };
  tick();
 }
 async function play(restart=false){
  const f=restart||frame>=totalFrames-1?0:frame;
  pause();playing=true;onState(true);const token=generation;
  await startPass(token,f);
 }
 return {play,pause,seek,get playing(){return playing;},get frame(){return frame;},totalFrames};
}
