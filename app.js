import {createGroupPlayer} from './group-player.js';
import {savePilot} from './storage.js';
import {CRITERIA,buildForm,buildPilot} from './design.js';
import {isChoice,nextCriterion,shortcutAction} from './interaction.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const catalog=await fetch('./catalog.json').then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json();});
const byId=new Map(catalog.cases.map(c=>[c.id,c]));
const lang='zh-en';
const poolReady=catalog.cases.length===30&&catalog.cases.every(c=>Object.keys(c.baselines).length>=2);
let activeQuestion=0;
const KEY='study60-participant-v1-'+catalog.version;let session;try{session=JSON.parse(localStorage.getItem(KEY));}catch{}
let active,media=[],playing=false,player=null,loadId=0,saveQueue=Promise.resolve(),mediaOkay=false;
const tr=(zh,en)=>zh===en?zh:zh+' · '+en;
function show(id){for(const x of ['intro','study','done'])$('#'+x).hidden=x!==id;window.scrollTo(0,0);}
function answered(){return session?session.answers.reduce((n,x)=>n+Object.values(x.values||{}).filter(isChoice).length,0):0;}
function event(type,data={}){if(session)session.events.push({type,at:new Date().toISOString(),trial:session.current,...data});}
function save(){if(!session)return;session.updatedAt=new Date().toISOString();session.revision=(session.revision||0)+1;localStorage.setItem(KEY,JSON.stringify(session));const payload=JSON.stringify(session);$('#save-status').textContent=tr('已保存到本机，正在同步回答…','Saved locally; syncing responses…');saveQueue=saveQueue.catch(()=>{}).then(async()=>{await savePilot(JSON.parse(payload));$('#save-status').textContent=tr('回答已保存','Responses saved');}).catch(()=>{$('#save-status').textContent=tr('已保存到本机；网络同步暂不可用，可导出记录。','Saved locally; server sync unavailable. You can export your record.');});}
function introCopy(){
 $('#draft-label').textContent=tr('视频评价','VIDEO STUDY');
 $('#intro-title').innerHTML='两个视频，你的判断。<span class="english-title" lang="en">Two videos. Your judgment.</span>';
 $('#intro-lead').textContent=tr('观看同一段人类操作视频的两种机器人编辑结果，选择更符合要求的一项。方法名称全程隐藏，没有标准答案。','Compare two robot edits of the same human demonstration. Choose the result that better meets each criterion. Method names are hidden, and there are no right answers.');
 $$('.facts span').forEach((x,i)=>x.textContent=tr(['组视频比较','每组评价问题','个选择'][i],['video comparisons','criteria per comparison','answers'][i]));
 $('#instructions').innerHTML='<h2>如何参与 · How it works</h2><ol><li>先看人类源视频和目标机器人参考。<span lang="en">Look at the human source video and target robot reference.</span></li><li>同步观看 A、B 两个视频，可以反复播放。<span lang="en">Watch videos A and B together. Replay whenever needed.</span></li><li>每题必须选择 A 或 B 中更好的一项。<span lang="en">For every question, choose the better result: A or B.</span></li><li>按 ← / → 回答当前高亮问题，自动进入下一问；四问答完，按空格进入下一组，Backspace 返回上一组。<span lang="en">Press ← / → to answer the highlighted question and advance. After four answers, press Space for the next comparison or Backspace to go back.</span></li></ol><p>可以随时作答。短视频播完停在末帧，等最长的视频结束后一起重播。<br><span lang="en">Answer at any time. Shorter videos hold their last frame until the longest ends, then all videos replay together.</span></p>';

 $('#consent-copy').textContent=tr('我自愿参与，了解匿名回答将用于视频质量评价，并可随时退出。','I voluntarily agree to take part. My anonymous answers will be used to evaluate video quality, and I may stop at any time.');
 $('#count-copy').textContent=tr('共 60 组，每组 4 个问题。进度会自动保存。','60 comparisons, with 4 questions each. Your progress is saved automatically.');
 $('#pause-session').textContent=tr('保存并暂停','Save & pause');$('#replay').textContent=tr('↻ 重播','↻ Replay');
 $('#done-title').textContent=tr('填写完成。','Complete.');$('#done-copy').textContent=tr('60 组视频、240 个选择已记录。你可以下载自己的回答。','Your 60 comparisons and 240 answers have been recorded. You can download your responses.');$('#export').textContent=tr('下载回答 JSON','Download JSON');$('#export-csv').textContent=tr('下载回答 CSV','Download CSV');

 document.documentElement.lang='zh-CN';
 $('#start').disabled=!$('#consent').checked||!poolReady;$('#resume').hidden=!session;$('#start').textContent=tr('开始填写 →','Start →');$('#resume').textContent=tr('继续上次进度','Resume saved progress');
 $('#source-label').textContent=tr('人类源视频','Human source video');$('#target-label').textContent=tr('目标机器人参考','Target robot reference');$('#task-copy').textContent=tr('将人手替换为参考中的机器人，保留原动作、物体运动和场景。','Replace the human hands with the reference robot while preserving the actions, objects and scene.');
 $('#ratings-title').textContent=tr('分别评价这四项','Rate each of these four aspects');$('#ratings-hint').textContent=tr('视频同步循环播放，可随时用 ← / → 逐题选择。','Videos loop together. Use ← / → to answer at any time.');
}
function start(){if(!poolReady)return;stop();const seed=crypto.getRandomValues(new Uint32Array(1))[0],form=seed%26;const deck=buildPilot(catalog.cases,catalog.methods,seed);const query=new URLSearchParams(location.search),caseId=query.get('case'),methodId=query.get('method');let researcherPreview=false;if(byId.get(caseId)?.baselines[methodId]){const existing=deck.findIndex(x=>x.caseId===caseId&&x.methodId===methodId);if(existing>=0){const [first]=deck.splice(existing,1);deck.unshift(first);}else {const i=deck.findIndex(x=>x.caseId===caseId);const first={...deck[i],methodId};deck.splice(i,1);deck.unshift(first);}researcherPreview=true;}session={id:crypto.randomUUID(),responseKey:crypto.randomUUID()+crypto.randomUUID(),pilot:false,qa:query.get('qa')==='1',researcherPreview,version:catalog.version,protocol:'60-pairs-4-criteria-forced-ab-v2',casePoolComplete:catalog.complete,form,seed,deck,language:lang,current:0,createdAt:new Date().toISOString(),answers:deck.map(()=>({values:{},watched:false})),events:[]};event('start');save();loadTrial();}
function stop(){player?.pause();playing=false;media.forEach(x=>x.el.pause());$('#play').textContent=tr('▶ 同步播放','▶ Play together');}
function setFrame(f){player?.seek(f);}
function activateQuestion(index,focus=false){
 activeQuestion=index;
 $$('.question').forEach((el,i)=>{el.classList.toggle('active-question',i===index);el.setAttribute('aria-current',i===index?'step':'false');if(i===index&&focus){el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});}});
 const complete=CRITERIA.every(q=>isChoice(session.answers[session.current].values[q.id]));
 $('#keyboard-current').textContent=complete?tr('四题已答完，按空格进入下一组。','All four answers are complete. Press Space for the next comparison.'):tr(`当前问题 ${index+1}/4：← 选 A，→ 选 B；回答后自动进入下一问。`,`Question ${index+1}/4: ← selects A, → selects B; then advances automatically.`);
}
function choose(value, index=activeQuestion){
 const a=session?.answers[session.current];
 if(!a||!mediaOkay||!isChoice(value))return;
 a.values[CRITERIA[index].id]=value;a.answeredAt=new Date().toISOString();event('answer',{criterion:CRITERIA[index].id,choice:value});
 activeQuestion=nextCriterion(a.values,CRITERIA.map(q=>q.id),index);save();choices();activateQuestion(activeQuestion,true);
}
function choices(){
 const a=session.answers[session.current];$('#questions').replaceChildren();
 CRITERIA.forEach((q,qi)=>{
  const field=document.createElement('fieldset');field.className='question';field.tabIndex=-1;field.dataset.criterion=q.id;
  const legend=document.createElement('legend');legend.textContent=`${qi+1}. ${q.zh}`;
  const english=document.createElement('span');english.lang='en';english.className='question-english';english.textContent=q.en;legend.append(english);
  const p=document.createElement('p');p.textContent=q.zhHelp;const helpEn=document.createElement('span');helpEn.lang='en';helpEn.className='help-english';helpEn.textContent=q.enHelp;p.append(helpEn);
  const box=document.createElement('div');box.className='choices';box.setAttribute('role','group');box.setAttribute('aria-label',q.zh+' / '+q.en);
  for(const [value,label] of [['A','A(←)'],['B','B(→)']]){
   const btn=document.createElement('button');btn.className='choice';btn.textContent=label;btn.dataset.choice=value;btn.setAttribute('aria-pressed',a.values[q.id]===value?'true':'false');btn.disabled=!mediaOkay;btn.onclick=()=>choose(value,qi);box.append(btn);
  }
  field.onclick=e=>{if(!e.target.closest('.choice'))activateQuestion(qi,true);};field.addEventListener('focusin',()=>activateQuestion(qi));
  field.append(legend,p,box);$('#questions').append(field);
 });
 $('#next').disabled=!mediaOkay||CRITERIA.some(q=>!isChoice(a.values[q.id]));
 $('#answered-count').textContent=tr(`${answered()} / 240 个选择`,`${answered()} / 240 answers`);activateQuestion(activeQuestion);
}
async function loadTrial(){
 stop();player=null;show('study');const id=++loadId;mediaOkay=false;$('#media-error').hidden=true;$('#play').disabled=true;$('#replay').disabled=true;
 activeQuestion=Math.max(0,CRITERIA.findIndex(q=>!isChoice(session.answers[session.current].values[q.id])));
 const pair=session.deck[session.current],c=byId.get(pair.caseId),b=c.baselines[pair.methodId];if(!c||!b)throw Error('Saved comparison is no longer present.');
 const indices=b.sourceFrameIndices;const contiguous=indices.every((x,i)=>x===i);if(!contiguous){$('#media-error').hidden=false;$('#media-error').textContent=tr('该结果不是连续帧，暂不进入此问卷版本。','This non-contiguous result is not supported in this questionnaire version.');return;}
 const lastFrame=Math.max(c.source.frames,c.ours.frames,b.frames)-1;active={pair,c,b,lastFrame,sourceFps:c.source.fps};
 media=[{el:$('#source'),...c.source},{el:$('#video-a'),...(pair.oursA?c.ours:b)},{el:$('#video-b'),...(pair.oursA?b:c.ours)}];
 $('#reference').src=c.reference.url;$('#trial-title').textContent=tr(`第 ${session.current+1} / 60 组`,`Comparison ${session.current+1} of 60`);$('#section-label').textContent=tr('视频比较','VIDEO COMPARISON');$('#progress-fill').style.width=(session.current/60*100)+'%';$('#previous').disabled=session.current===0;$('#previous').textContent=tr('上一组（Backspace）','Previous (Backspace)');$('#next').textContent=session.current===59?tr('完成（空格）','Finish (Space)'):tr('下一组（空格）','Next (Space)');$('#scrub').max=lastFrame;$('#scrub').value=0;
 $('#range-note').textContent=tr('同帧同步；短视频停在末帧，最长视频结束后一起重播。','Frame-aligned playback: shorter videos hold their last frame; all replay when the longest ends.');
 $('#media-status').textContent=tr('正在加载视频…','Loading videos…');choices();
 try{await Promise.all(media.map(x=>new Promise((resolve,reject)=>{const el=x.el;el.oncanplay=()=>resolve();el.onerror=()=>reject(Error('Video could not be loaded'));el.src=x.url;el.playbackRate=c.source.fps/x.fps;el.load();if(el.readyState>=3)resolve();})));if(id!==loadId)return;media.forEach(x=>{x.el.defaultPlaybackRate=c.source.fps/x.fps;x.el.playbackRate=c.source.fps/x.fps;});mediaOkay=true;
 player=createGroupPlayer(media,{sourceFps:c.source.fps,
  onFrame:f=>{if(id===loadId){$('#scrub').value=Math.floor(f);$('#clock').textContent=(f/c.source.fps).toFixed(2)+' s';}},
  onState:value=>{if(id===loadId){playing=value;$('#play').textContent=value?tr('Ⅱ 暂停','Ⅱ Pause'):tr('▶ 同步播放','▶ Play together');}},
  onCycle:({complete})=>{if(id!==loadId||!complete)return;const a=session.answers[session.current];if(!a.watched){a.watched=true;a.completedPlaybackAt=new Date().toISOString();event('complete_playback');save();}},
  onError:()=>{if(id===loadId)$('#media-status').textContent=tr('播放被浏览器拦截，请再次点击播放。','Playback was blocked; click Play again.');}
 });setFrame(0);$('#play').disabled=false;$('#replay').disabled=false;$('#media-status').textContent=tr('视频已就绪。三个视频按同一动作进度播放。','Ready. The three videos play at matching source times.');choices();event('media_ready');await play(true);}
 catch{if(id!==loadId)return;mediaOkay=false;$('#media-error').hidden=false;$('#media-error').replaceChildren();const msg=document.createElement('p');msg.textContent=tr('视频加载失败。本组暂不允许作答，请重试；加载错误不会计为方法失败。','Video loading failed. Ratings are disabled; a loading error is not treated as a method failure.');const retry=document.createElement('button');retry.className='secondary';retry.textContent=tr('重新加载','Retry loading');retry.onclick=loadTrial;$('#media-error').append(msg,retry);event('media_error');choices();}
}
async function play(restart=false){if(!mediaOkay||!player)return;if(playing&&!restart){stop();event('pause');return;}event('play',{sourceFrame:restart?0:player.frame});await player.play(restart);}
function exportData(csv=false){const {responseKey,...publicSession}=session;const data={...publicSession,criteria:CRITERIA.map(x=>x.id),exportedAt:new Date().toISOString()};let content,type,name;if(csv){const rows=[['participant','pilot','form','trial','case_id','baseline','ours_side','criterion','choice','watched']];session.deck.forEach((x,i)=>CRITERIA.forEach(q=>rows.push([session.id,'false',session.form,i+1,x.caseId,x.methodId,x.oursA?'A':'B',q.id,session.answers[i].values[q.id]||'',session.answers[i].watched])));content=rows.map(r=>r.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n');type='text/csv;charset=utf-8';name='responses-'+session.id+'.csv';}else{content=JSON.stringify(data,null,2);type='application/json';name='responses-'+session.id+'.json';}const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#consent').onchange=()=>{$('#start').disabled=!$('#consent').checked||!poolReady;};$('#start').onclick=start;$('#resume').onclick=()=>{if(session.current>=60)show('done');else loadTrial();};$('#play').onclick=()=>play();$('#replay').onclick=()=>play(true);$('#scrub').oninput=()=>{stop();setFrame(Number($('#scrub').value));};$('#previous').onclick=()=>{if(!session||session.current<=0)return;session.current--;event('previous');save();loadTrial();};$('#next').onclick=()=>{if($('#next').disabled)return;stop();session.current++;event('next');save();if(session.current===60){show('done');event('pilot_complete');save();}else loadTrial();};$('#pause-session').onclick=()=>{stop();event('save_and_pause');save();introCopy();show('intro');};$('#export').onclick=()=>exportData();$('#export-csv').onclick=()=>exportData(true);window.addEventListener('keydown',e=>{
 const action=shortcutAction(e);if(!action||!session)return;
 if(!$('#study').hidden){
  e.preventDefault();
  if(action==='A'||action==='B')choose(action);
  else if(action==='next')$('#next').click();
  else $('#previous').click();
 }
});$$('[data-expand]').forEach(btn=>btn.onclick=()=>$('#'+btn.dataset.expand).requestFullscreen?.());window.addEventListener('beforeunload',()=>{if(session)localStorage.setItem(KEY,JSON.stringify(session));});introCopy();
