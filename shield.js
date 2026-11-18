/* PTeno Shield 0.1 for the PTeno TV-owned HTML5 player.
   Not a browser extension, network proxy, or Twitch-ad blocker.
   Videos served through Invidious avoid conventional YouTube ad insertion.
   SponsorBlock skips creator-declared sponsor/self-promotion segments by timestamp.
*/
(function(){
'use strict';
var video=document.getElementById('ytVideo');
var toggle=document.getElementById('shieldToggle');
var status=document.getElementById('shieldStatus');
if(!video||!toggle||!status)return;
var KEY='ptenotv_shield_enabled';
var enabled=true;
try{enabled=localStorage.getItem(KEY)!=='false';}catch(e){}
var segments=[];
var videoId='';
var generation=0;
var loadingController=null;
function show(message){status.textContent=message;}
function updateToggle(){
toggle.textContent=enabled?'PTeno Shield: увімкнено':'PTeno Shield: вимкнено';
toggle.setAttribute('aria-pressed',String(enabled));
}
function cancel(){
generation++;
segments=[];
videoId='';
if(loadingController){try{loadingController.abort();}catch(e){}}
loadingController=null;
}
function load(id){
cancel();
videoId=id;
var current=++generation;
if(!enabled){show('Shield вимкнено. Режим Invidious залишається без звичайних рекламних вставок YouTube.');return;}
if(!/^[A-Za-z0-9_-]{11}$/.test(id)){show('Немає відео для перевірки.');return;}
show('Перевіряю SponsorBlock для цього відео...');
var controller=null,timer=null;
var options={method:'GET',mode:'cors',credentials:'omit',cache:'no-store'};
if(typeof AbortController!=='undefined'){
controller=new AbortController();loadingController=controller;
options.signal=controller.signal;
timer=setTimeout(function(){controller.abort();},6500);
}
var categories=['sponsor','selfpromo'];
var url='https://sponsor.ajay.app/api/skipSegments?videoID='+encodeURIComponent(id)+'&categories='+encodeURIComponent(JSON.stringify(categories));
fetch(url,options).then(function(response){
if(response.status===404)return [];
if(!response.ok)throw Error('HTTP '+response.status);
return response.json();
}).then(function(data){
if(timer)clearTimeout(timer);
if(current!==generation||videoId!==id)return;
loadingController=null;
segments=(Array.isArray(data)?data:[]).map(function(entry){
return entry&&Array.isArray(entry.segment)?{start:Number(entry.segment[0]),end:Number(entry.segment[1])}:null;
}).filter(function(x){
return x&&isFinite(x.start)&&isFinite(x.end)&&x.start>=0&&x.end>x.start&&x.end-x.start<1800;
}).sort(function(a,b){return a.start-b.start;});
show(segments.length?'PTeno Shield: знайдено рекламних/спонсорських фрагментів: '+segments.length+'. Автопропуск увімкнено.':'PTeno Shield: спонсорських фрагментів у базі не знайдено.');
},function(error){
if(timer)clearTimeout(timer);
if(current!==generation||videoId!==id)return;
loadingController=null;
show('SponsorBlock недоступний у цьому браузері ('+String(error.message||'мережа')+'). Відтворення відео продовжується.');
});
}
function clear(){
cancel();
show(enabled?'PTeno Shield готовий. Обери відео.':'PTeno Shield вимкнено.');
}
video.addEventListener('timeupdate',function(){
if(!enabled||!videoId||!segments.length)return;
var t=video.currentTime;
if(!isFinite(t)||t<0)return;
for(var i=0;i<segments.length;i++){
var s=segments[i];
if(t>=s.start&&t<s.end-0.12){
var target=s.end+0.08;
if(isFinite(video.duration)&&video.duration>0)target=Math.min(target,video.duration);
try{video.currentTime=target;show('PTeno Shield: пропущено спонсорський фрагмент ('+Math.round(s.end-s.start)+' с).');}catch(e){}
break;
}
}
});
toggle.onclick=function(){
enabled=!enabled;
try{localStorage.setItem(KEY,String(enabled));}catch(e){}
updateToggle();
if(videoId){var currentId=videoId;load(currentId);}else clear();
};
updateToggle();
clear();
window.PTenoShield={load:load,clear:clear,isEnabled:function(){return enabled;}};
})();