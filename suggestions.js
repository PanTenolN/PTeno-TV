/* PTeno TV 0.4 — remote-friendly autocomplete.
 * Results persist after the on-screen keyboard closes.
 * YouTube: Google Suggest / Invidious / local history.
 * Twitch: Google search suggestions for possible channel names + local history.
 * Google results are NOT verified Twitch accounts.
 */
(function(){
'use strict';
function el(id){return document.getElementById(id);}
var youtube=el('youtubeQuery'),twitch=el('twitchChannel');
if(!youtube||!twitch||!el('youtubeSuggestions')||!el('twitchSuggestions'))return;
function readHistory(key){
try{var a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(function(s){return typeof s==='string';}).slice(0,24):[];}catch(e){return [];}
}
var histories={
youtube:readHistory('ptenotv_recent_yt'),
twitch:readHistory('ptenotv_recent_tw')
};
function record(kind,text){
var val=(text||'').trim();
if(!val||val.length>120)return;
var arr=histories[kind];
arr=arr.filter(function(x){return x.toLowerCase()!==val.toLowerCase();});
arr.unshift(val);
histories[kind]=arr.slice(0,24);
try{localStorage.setItem('ptenotv_recent_'+(kind==='youtube'?'yt':'tw'),JSON.stringify(histories[kind]));}catch(e){}
}
function setup(kind,input,list){
var current=[],selected=-1,sequence=0,delay=null;
var chooseButton=el(kind==='youtube'?'youtubePickSuggestion':'twitchPickSuggestion');
if(chooseButton){
chooseButton.onclick=function(){
if(list.hidden||!list.firstElementChild)return;
list.firstElementChild.focus();
};
}
function close(){
list.hidden=true;list.textContent='';if(chooseButton)chooseButton.hidden=true;input.setAttribute('aria-expanded','false');
input.removeAttribute('aria-activedescendant');selected=-1;current=[];
}
function draw(items){
current=items.slice(0,8);
selected=-1;list.textContent='';
if(!current.length){close();return;}
current.forEach(function(entry,i){
var b=document.createElement('button');
b.className='suggest-item';b.type='button';b.id=kind+'-suggest-'+i;
b.setAttribute('role','option');b.setAttribute('aria-selected','false');
b.textContent=entry.value;
var sub=document.createElement('span');sub.className='suggest-source';sub.textContent=entry.source;
b.appendChild(sub);
b.onclick=function(){pick(i);};
list.appendChild(b);
});
list.hidden=false;if(chooseButton)chooseButton.hidden=false;input.setAttribute('aria-expanded','true');
}
function pick(i){
if(i<0||i>=current.length)return;
var chosen=current[i].value;
input.value=chosen;
close();
record(kind,chosen);
if(kind==='youtube')el('youtubeSearch').click();
else el('twitchOpen').click();
}
function move(step){
if(!current.length)return;
selected=(selected+step+current.length)%current.length;
Array.prototype.forEach.call(list.children,function(node,i){
node.setAttribute('aria-selected',i===selected?'true':'false');
});
var active=list.children[selected];
input.setAttribute('aria-activedescendant',active.id);
if(active.scrollIntoView)active.scrollIntoView({block:'nearest'});
}
function recent(query){
var low=query.toLowerCase();
return histories[kind].filter(function(x){return x.toLowerCase().indexOf(low)!==-1;}).map(function(x){
return {value:x,source:kind==='youtube'?'Попередній пошук':'Нещодавно відкритий канал'};
});
}
function combine(local,online){
var used={},out=[];
local.concat(online).forEach(function(entry){
var value=(entry&&entry.value||'').trim();
var key=value.toLowerCase();
if(!value||used[key]||value.length>120)return;
used[key]=true;out.push({value:value,source:entry.source||'Підказка'});
});
return out.slice(0,8);
}
function update(){
clearTimeout(delay);
var request=++sequence;
var value=input.value.trim();
if(!value){close();return;}
var local=recent(value);
draw(local);
if(value.length<2)return;
delay=setTimeout(function(){
getOnline(kind,value,function(online){
if(request!==sequence||input.value.trim()!==value)return;
draw(combine(local,online));
});
},340);
}
input.addEventListener('input',update);
input.addEventListener('focus',function(){if(input.value.trim())update();});
input.addEventListener('keydown',function(event){
var key=event.key||'',code=event.keyCode;
var up=key==='ArrowUp'||code===38,down=key==='ArrowDown'||code===40;
var enter=key==='Enter'||code===13;
var back=key==='Escape'||code===27||code===461||code===10009;
if((up||down)&&!list.hidden){
event.preventDefault();event.stopImmediatePropagation();move(down?1:-1);return;
}
if(enter&&selected>=0&&!list.hidden){
event.preventDefault();event.stopImmediatePropagation();pick(selected);return;
}
if(back&&!list.hidden){
event.preventDefault();event.stopImmediatePropagation();
if(document.activeElement===input){
input.blur(); // TV closes keyboard; suggestions stay on screen.
if(list.firstElementChild)list.firstElementChild.focus();
}else close();
}
},true);
// Do NOT close on blur: on Sharp TiVo OS dismissing the keyboard blurs inputs.
// The dropdown remains available to remote arrows/OK and the separate "Choose" button.

return {close:close,update:update};
}
var lastCallback=0;
function getGoogleSuggest(query,finish){
var key='__ptenoSuggest'+(++lastCallback),finished=false;
var tag=document.createElement('script');
var timeout=setTimeout(function(){done(null);},2500);
function done(value){
if(finished)return;
finished=true;clearTimeout(timeout);
try{delete window[key];}catch(e){window[key]=undefined;}
if(tag.parentNode)tag.parentNode.removeChild(tag);
finish(value);
}
window[key]=function(data){
var list=Array.isArray(data)&&Array.isArray(data[1])?data[1]:[];
done(list.map(function(e){return Array.isArray(e)?e[0]:e;}).filter(function(e){return typeof e==='string';}));
};
tag.onerror=function(){done(null);};
tag.src='https://suggestqueries.google.com/complete/search?client=chrome&ds=yt&hl=uk&gl=IE&ie=utf-8&oe=utf-8&q='+encodeURIComponent(query)+'&callback='+encodeURIComponent(key);
document.head.appendChild(tag);
}
function getInvidiousSuggest(query,finish){
var server='https://inv.nadeko.net/';
try{var saved=localStorage.getItem('ptenotv_invidious');if(saved&&new URL(saved).protocol==='https:')server=saved;}catch(e){}
server=server.replace(/\/+$/,'');
var done=false,timer=null,ctrl=null,options={mode:'cors',credentials:'omit'};
if(typeof AbortController!=='undefined'){ctrl=new AbortController();options.signal=ctrl.signal;timer=setTimeout(function(){ctrl.abort();},2500);}
function finishOnce(v){if(done)return;done=true;if(timer)clearTimeout(timer);finish(v||[]);}
fetch(server+'/api/v1/search/suggestions?q='+encodeURIComponent(query),options).then(function(r){
if(!r.ok)throw Error('HTTP '+r.status);return r.json();
}).then(function(data){finishOnce(Array.isArray(data.suggestions)?data.suggestions:[]);}).catch(function(){finishOnce([]);});
}
function getOnline(kind,query,done){
if(kind==='twitch'){
// Public search suggestions, not confirmed Twitch accounts. Official Helix search requires OAuth.
getGoogleSuggest('twitch '+query,function(list){
var values=[];
(list||[]).forEach(function(item){
if(typeof item!=='string')return;
var found=item.trim().replace(/^twitch(?:\.tv)?(?:\s+|\/|\s*[:\-]\s*)/i,'').trim();
if(!/^[A-Za-z0-9_]{3,25}$/.test(found))return;
// Only show plausible channel logins; streamer existence is not verified.
if(found.toLowerCase().indexOf(query.toLowerCase())!==0)return;
values.push({value:found,source:'Можливий канал · підказка Google (не перевірено)'});
});
done(values);
});
return;
}
getGoogleSuggest(query,function(list){
if(Array.isArray(list)&&list.length){done(list.map(function(x){return {value:x,source:'Пошукова підказка Google'};}));return;}
getInvidiousSuggest(query,function(items){
done(items.map(function(x){return {value:x,source:'Підказка Invidious'};}));
});
});
}
var ytUI=setup('youtube',youtube,el('youtubeSuggestions'));
var twUI=setup('twitch',twitch,el('twitchSuggestions'));
el('youtubeSearch').addEventListener('click',function(){record('youtube',youtube.value);ytUI.close();});
el('youtubePopular').addEventListener('click',function(){ytUI.close();});
el('twitchOpen').addEventListener('click',function(){
var v=twitch.value.trim().replace(/^@/,'');
if(/^[A-Za-z0-9_]{3,25}$/.test(v)){record('twitch',v);}
twUI.close();
});
// Main page URL parameter may trigger an immediate search; keep that query in history.
var q=(new URLSearchParams(location.search)).get('q');
if(q)record('youtube',q);
})();