export async function savePilot(data){
 const {responseKey,...record}=data;
 if(!responseKey||data.pilot!==false||data.deck?.length!==60||data.answers?.length!==60)throw Error('Invalid response record');
 const r=await fetch('https://roboedit-study30-preview.yaoweiguo96.chatgpt.site/api/responses/'+data.id,{method:'PUT',headers:{'Content-Type':'application/json','X-Response-Key':responseKey},body:JSON.stringify(record)});
 if(!r.ok)throw Error('Response save failed: '+r.status);return r.json();
}
