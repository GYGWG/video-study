export const CRITERIA=[
 {id:'overall',en:'Overall quality',zh:'整体质量',enHelp:'Which result is better overall, considering visual quality, naturalness and temporal consistency?',zhHelp:'综合画面质量、自然程度和时间连续性，哪个结果整体更好？'},
 {id:'motion',en:'Action & interaction preservation',zh:'动作与交互保持',enHelp:'Which result better preserves the actions, object motion and order of interactions in the human source video?',zhHelp:'哪一个更忠实地保留源视频中的动作、物体运动和交互顺序？'},
 {id:'embodiment',en:'Robot appearance consistency',zh:'机器人外观保持',enHelp:'Which result better matches the target robot and keeps its appearance stable throughout the clip?',zhHelp:'哪一个更符合目标机器人，且机器人的外观在片段中保持稳定？'},
 {id:'contact',en:'Contact plausibility',zh:'接触合理性',enHelp:'Which result shows more plausible hand–object contact, with less visible penetration, floating or abnormal sliding?',zhHelp:'哪一个手物接触更合理，明显穿透、悬空或异常滑动更少？'}
];
export function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(xs,random){const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function buildForm(cases,methods,form,seed){
 if(cases.length!==30||methods.length!==13)throw Error('The balanced design requires 30 cases and 13 configurations.');
 const deck=[];for(let c=0;c<30;c++){
  const append=(m)=>{const row=cases[c],method=methods[m],b=row.baselines[method.id];if(!b)throw Error('Missing verified comparison: '+row.id+'/'+method.id);deck.push({caseId:row.id,methodId:method.id,oursA:!!((c%2)^(Math.floor(form/13)%2))});};
  append((c+form)%13);append((c+form+6)%13);
 }
 return separate(shuffle(deck,rng(seed)));
}
function separate(a){const out=[],pool=[...a];while(pool.length){const counts=new Map();pool.forEach(x=>counts.set(x.caseId,(counts.get(x.caseId)||0)+1));let best=-1;for(let i=0;i<pool.length;i++){if(pool[i].caseId===out.at(-1)?.caseId)continue;if(best<0||counts.get(pool[i].caseId)>counts.get(pool[best].caseId))best=i;}if(best<0)throw Error('Unable to separate repeated cases.');out.push(pool.splice(best,1)[0]);}return out;}
export function buildPilot(cases,methods,seed){
 if(cases.length!==30||cases.some(c=>Object.keys(c.baselines).length<2))throw Error('All 30 cases need at least two verified baselines.');
 const random=rng(seed),deck=[];
 for(const c of shuffle(cases,random)){
  const pool=shuffle(Object.keys(c.baselines),random);
  for(let n=0;n<2;n++){
   const methodId=pool.shift();deck.push({caseId:c.id,methodId});
  }
 }
 const ordered=separate(shuffle(deck,random)),sides=shuffle([...Array(30).fill(true),...Array(30).fill(false)],random);
 return ordered.map((x,i)=>({...x,oursA:sides[i]}));
}
