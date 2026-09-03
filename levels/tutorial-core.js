(()=>{'use strict';
const C=window.TUTORIAL_LEVEL_CONFIG;
const MESSAGE_ORIGIN=location.protocol==='file:'?'*':location.origin;
if(!C)throw new Error('缺少教学关配置。');
const MAP=C.map,W=MAP[0].length,H=MAP.length;
const DIR={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],W:[0,-1],S:[0,1],A:[-1,0],D:[1,0]};
const MOVE={U:'ArrowUp',D:'ArrowDown',L:'ArrowLeft',R:'ArrowRight'},SYM={'0,-1':'↑','0,1':'↓','-1,0':'←','1,0':'→'};
const SOL=[...C.solution].map(v=>MOVE[v]);
const cv=document.querySelector('#game'),x=cv.getContext('2d'),badge=document.querySelector('#badge');
const ui=C.ui||{},COMPACT_LAYOUT=ui.compactSidebar===true,MAP_SCALE=ui.mapScale||1,VIEW_W=1420,VIEW_H=COMPACT_LAYOUT?735:970,DPR=Math.min(window.devicePixelRatio||1,2);cv.width=VIEW_W*DPR;cv.height=VIEW_H*DPR;cv.style.width=VIEW_W+'px';cv.style.height=VIEW_H+'px';x.setTransform(DPR,0,0,DPR,0,0);
const fu=new Image();fu.src='../assets/characters/fu.png';
const P=(x,y)=>({x,y}),cp=p=>p?P(p.x,p.y):null,eq=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y,inMap=p=>p.x>=0&&p.y>=0&&p.x<W&&p.y<H,raw=p=>inMap(p)?MAP[p.y][p.x]:'1';
let start,exit,keys=[],plates=[],boxesStart=[],portals={};
MAP.forEach((r,y)=>[...r].forEach((c,px)=>{const p=P(px,y);if(c==='S')start=p;if(c==='E')exit=p;if(c==='K')keys.push(p);if(c==='P')plates.push(p);if(c==='B')boxesStart.push(p);if(/[A-Z]/.test(c)&&!['S','E','K','B','P'].includes(c))portals[c]=p;}));
Object.keys(portals).forEach(k=>{let lower=k.toLowerCase(),target=MAP.flatMap((r,y)=>[...r].map((c,px)=>c===lower?P(px,y):null)).find(Boolean);if(target){portals[k].target=target;}});
function portalExit(p){const c=raw(p);if(/[A-Z]/.test(c)&&portals[c]?.target)return cp(portals[c].target);if(/[a-z]/.test(c)){const upper=c.toUpperCase();return portals[upper]&&eq(portals[upper].target,p)?cp(portals[upper]):null}return null}
function fresh(){return {p:cp(start),boxes:boxesStart.map(cp),keys:Array(keys.length).fill(false),step:0,status:'play',history:[],last:C.startText}}
let s=fresh();
const boxAt=(p,st=s)=>st.boxes.findIndex(b=>eq(b,p));
const gotAllKeys=(st=s)=>st.keys.every(Boolean);
const pressed=(st=s)=>plates.filter(p=>eq(st.p,p)||st.boxes.some(b=>eq(b,p))).length;
const platesReady=(st=s)=>C.plates==='none'||(C.plates==='any'?pressed(st)>0:pressed(st)===plates.length);
function snapshot(){return {p:cp(s.p),boxes:s.boxes.map(cp),keys:[...s.keys],step:s.step,status:s.status,last:s.last}}
function stop(){}
function showHintBar(html){const bar=document.querySelector('#hintBar'),text=document.querySelector('#hintText');bar.hidden=!html;text.innerHTML=html||''}
function fail(msg){s.status='fail';s.last=`<span class="warn">失败：</span>${msg}`;draw()}
function land(target,ignoreBox=-1){const end=portalExit(target);if(!end)return {ok:true,end:target,warp:false};const exitBox=boxAt(end);const blocked=(exitBox>=0&&exitBox!==ignoreBox)||eq(s.p,end);if(blocked)return {ok:true,end:target,warp:false,blockedPortal:true};return {ok:true,end,warp:true}}
function attempt(d){const [dx,dy]=d,target=P(s.p.x+dx,s.p.y+dy),bi=boxAt(target);
 if(raw(target)==='1')return {ok:false,why:'前方是墙壁'};
 if(bi>=0){const pushed=P(target.x+dx,target.y+dy);if(raw(pushed)==='1'||boxAt(pushed)>=0)return {ok:false,why:'箱子无法向该方向推动'};const landed=land(pushed,bi);if(!landed.ok)return {ok:false,why:landed.why};s.boxes[bi]=landed.end;return {ok:true,end:target,push:true,warp:landed.warp};}
 const landed=land(target);if(!landed.ok)return {ok:false,why:landed.why};return {ok:true,end:landed.end,warp:landed.warp};
}
function collect(notes){keys.forEach((p,i)=>{if(!s.keys[i]&&eq(s.p,p)){s.keys[i]=true;notes.push(`<span class="keyword">取得钥匙 ${i+1}</span>`);}})}
function winReady(){return (!C.keys||gotAllKeys())&&platesReady()}
function move(name,silent=false){if(s.status!=='play'||!DIR[name])return false;const before=snapshot(),d=DIR[name],r=attempt(d);if(!r.ok){s.last=`<b>第 ${s.step} 步未计入：</b>${r.why}`;if(!silent)draw();return false;}s.history.push(before);s.p=r.end;s.step++;const notes=[`芙 ${SYM[`${d[0]},${d[1]}`]} → (${s.p.x},${s.p.y})`];if(r.push)notes.push(r.warp?'箱子经传送门传送':r.blockedPortal?'传送出口被占用，箱子停在入口':'箱子被推动');else if(r.warp)notes.push('经传送门传送');else if(r.blockedPortal)notes.push('传送出口被占用，停留在入口');collect(notes);if(eq(s.p,exit)){if(winReady()){s.status='win';notes.push('<span class="keyword">全部条件满足，抵达 Exit，通关。</span>');if(!silent)notifyComplete();}else notes.push('<span class="warn">已抵达 Exit，但前置条件尚未满足。</span>');}s.last=notes.join('　·　');if(!silent)draw();return true;}
function notifyComplete(){if(window.parent!==window)window.parent.postMessage({type:'golden-scapegoat-complete',level:C.level},MESSAGE_ORIGIN)}
function reset(){s=fresh();showHintBar(null);draw()}
function undo(){showHintBar(null);if(!s.history.length||s.status==='win')return;const old=s.history.pop();s={...old,history:s.history};draw()}
function solverRequest(){
 const keyMask=s.keys.reduce((mask,got,i)=>got?(mask+(2**i)):mask,0);
 const idx=p=>p?p.y*W+p.x:-1;
 const plateMode=C.plates==='any'?'tutorial-any':(C.plates==='none'?'tutorial-none':'tutorial');
 return [MAP.join('~'),'','',idx(s.p),s.boxes.map(idx).join(','),keyMask,'','',s.step,plateMode].join('|');
}
function fallbackHint(){
 const name=SOL[s.step];
 if(!name){showHintBar('<span class="keyword">当前关卡已没有预写答案步骤。</span>');return;}
 const d=DIR[name];
 showHintBar(`<span class="keyword">提示：${SYM[`${d[0]},${d[1]}`]}</span>　提示不会替你移动。`);
}
async function hint(){
 if(s.status!=='play')return;
 showHintBar('C++ 正在于 400ms 内推演下一步……');
 try{
  if(typeof window.GoldenScapegoatHint!=='function')throw new Error('C++ 模块未加载');
  const answer=await window.GoldenScapegoatHint(solverRequest());
  const [kind,dir,count='0']=String(answer||'').split('|');
  const symbol={U:'↑',D:'↓',L:'←',R:'→'}[dir];
  if(kind==='FOUND'&&symbol)showHintBar(`<span class="keyword">C++ 提示：${symbol}</span>　已找到可通关路线。（已搜索 ${count} 个局面）`);
  else if(kind==='BEST'&&symbol)showHintBar(`<span class="keyword">C++ 提示：${symbol}</span>　400ms 已到：给出当前最有希望的安全方向。（已搜索 ${count} 个局面）`);
  else if(kind==='DONE')showHintBar('<span class="keyword">当前局面已经满足通关条件。</span>');
  else {console.warn('C++ 提示未给出方向：',answer);fallbackHint();}
 }catch(error){console.warn('C++ 提示模块不可用，改用后备提示。',error);fallbackHint();}
}
function rr(X,Y,w,h,r){x.beginPath();x.roundRect(X,Y,w,h,r)}
const baseTile=Math.min(38,Math.floor(660/Math.max(W,H))),Z=COMPACT_LAYOUT?Math.round(baseTile*MAP_SCALE):38,mapW=W*Z,mapH=H*Z,OX=COMPACT_LAYOUT?VIEW_W-mapW-36:690,OY=COMPACT_LAYOUT?Math.max(100,Math.round((VIEW_H-mapH)/2)):120;
function keyIcon(px,py,on){const r=Z*.16;x.save();x.translate(px+Z/2,py+Z/2);x.strokeStyle=on?'#4d5d78':'#ffe27e';x.lineWidth=Math.max(2,Math.round(Z*.08));x.lineCap='round';x.beginPath();x.arc(-r,-r*.65,r,0,Math.PI*2);x.moveTo(-r*.16,-r*.16);x.lineTo(r*1.82,r*1.82);x.moveTo(r*.98,r*.98);x.lineTo(r*1.65,r*.32);x.stroke();x.restore()}
function tile(px,py,c){const isWall=c==='1';x.fillStyle=isWall?'#16233c':'#0a1429';x.fillRect(px,py,Z,Z);x.strokeStyle=isWall?'#5f789e':'#1d3456';x.lineWidth=1;x.strokeRect(px+.5,py+.5,Z-1,Z-1);if(isWall){x.strokeStyle='#344a70';x.beginPath();x.moveTo(px,py+Z*.49);x.lineTo(px+Z,py+Z*.49);x.moveTo(px+Z*.5,py);x.lineTo(px+Z*.5,py+Z*.49);x.stroke();return;}const cx=px+Z/2,cy=py+Z/2;
 if(c==='P'){x.fillStyle='#44316d';rr(px+Z*.13,py+Z*.13,Z*.74,Z*.74,Math.max(6,Z*.18));x.fill();x.strokeStyle='#dfc3ff';x.stroke();x.fillStyle='#f3ddff';x.font=`900 ${Math.max(14,Math.round(Z*.37))}px Microsoft YaHei`;x.textAlign='center';x.textBaseline='middle';x.fillText('P',px+Z/2,py+Z*.52);x.textAlign='left';x.textBaseline='alphabetic'}
 if(c==='E'){x.fillStyle='#183f3a';rr(px+4,py+4,Z-8,Z-8,7);x.fill();x.strokeStyle='#8ff0c7';x.stroke();x.fillStyle='#c8ffe9';x.font=`900 ${Math.max(10,Math.round(Z*.25))}px Microsoft YaHei`;x.textAlign='center';x.fillText('EXIT',px+Z/2,py+Z*.59);x.textAlign='left'}
 if(c==='K')keyIcon(px,py,s.keys[keys.findIndex(k=>k.x===Math.round((px-OX)/Z)&&k.y===Math.round((py-OY)/Z))]);
 if(/[A-Za-z]/.test(c)&&!['S','E','K','B','P'].includes(c)){const colors={M:'#74eaff',N:'#ffd66f',C:'#ff95d1',Q:'#90f5b9'};const co=colors[c.toUpperCase()]||'#c79cff';x.strokeStyle=co;x.lineWidth=3;x.beginPath();x.arc(cx,cy,Z*.28,0,Math.PI*2);x.stroke();x.fillStyle=co+'33';x.fill();}
}
function crate(p){const px=OX+p.x*Z,py=OY+p.y*Z;x.fillStyle='#d88924';rr(px+6,py+6,Z-12,Z-12,5);x.fill();x.strokeStyle='#fff0ae';x.lineWidth=1.3;x.strokeRect(px+9,py+9,Z-18,Z-18);x.beginPath();x.moveTo(px+9,py+9);x.lineTo(px+Z-9,py+Z-9);x.moveTo(px+Z-9,py+9);x.lineTo(px+9,py+Z-9);x.stroke()}
function entity(p){const px=OX+p.x*Z,py=OY+p.y*Z;x.save();rr(px+3,py+3,Z-6,Z-6,7);x.clip();if(fu.complete&&fu.naturalWidth){const scale=Math.min((Z-6)/fu.naturalWidth,(Z-6)/fu.naturalHeight),w=fu.naturalWidth*scale,h=fu.naturalHeight*scale;x.drawImage(fu,px+(Z-w)/2,py+(Z-h)/2,w,h)}else{x.fillStyle='#ffd66f';x.fillRect(px+4,py+4,Z-8,Z-8)}x.restore();x.strokeStyle='#ffeaa6';x.lineWidth=2;rr(px+3,py+3,Z-6,Z-6,7);x.stroke();x.fillStyle='#fff';x.font='900 10px Microsoft YaHei';x.fillText('芙',px+14,py+25)}
function panel(X,Y,w,h,title){x.fillStyle='#0b1730';rr(X,Y,w,h,13);x.fill();x.strokeStyle='#496493';x.lineWidth=1.4;x.stroke();x.fillStyle='#ffd971';x.font='900 17px Microsoft YaHei';x.fillText(title,X+17,Y+30)}
function stat(X,Y,title,val,col,w=500){x.fillStyle='#081328';rr(X,Y,w,57,9);x.fill();x.strokeStyle='#2d4773';x.stroke();x.fillStyle='#9bb0d5';x.font='700 12px Microsoft YaHei';x.fillText(title,X+12,Y+20);x.fillStyle=col;x.font='900 15px Microsoft YaHei';x.fillText(val,X+12,Y+43)}
function goalPanel(X,Y,w){panel(X,Y,w,132,'通关目标');let yy=Y+58;if(C.keys){x.fillStyle='#d4e0f5';x.font='700 15px Microsoft YaHei';x.fillText('收集全部钥匙',X+18,yy);yy+=25}if(C.plates!=='none'){x.fillStyle='#d4e0f5';x.fillText(C.plates==='all'?'压住所有压板':'压住任意一块压板',X+18,yy);yy+=25}x.fillStyle='#a9ffd5';x.font='900 15px Microsoft YaHei';x.fillText('抵达 Exit',X+18,yy)}function wrapText(text,maxWidth){const lines=[];let line='';for(const ch of text){const next=line+ch;if(line&&x.measureText(next).width>maxWidth){lines.push(line);line=ch}else line=next}if(line)lines.push(line);return lines}function textLines(text,X,Y,maxWidth,lineHeight,color,font){x.fillStyle=color;x.font=font;let yy=Y;for(const line of wrapText(text,maxWidth)){x.fillText(line,X,yy);yy+=lineHeight}return yy}function tutorialInfo(X,Y,w){panel(X,Y,w,265,'本关说明');let yy=Y+68;yy=textLines(C.startText,X+18,yy,w-36,23,'#dbe7fa','700 16px Microsoft YaHei')+18;x.fillStyle='#ffdc8b';x.font='900 15px Microsoft YaHei';x.fillText('地图元素',X+18,yy);yy+=25;const legend=[];if(keys.length)legend.push('金色钥匙 K：需要由芙收集。');if(plates.length)legend.push('紫色方框 P：压板；芙或箱子站在上面时会被压住。');if(boxesStart.length)legend.push('橙色箱子：芙可以推动。');if(Object.keys(portals).length)legend.push('彩色圆环：同色双向传送门。');if(!legend.length)legend.push('深色砖块：墙壁；绿色 EXIT：出口。');for(const item of legend)yy=textLines('• '+item,X+18,yy,w-36,20,'#d5e1f4','700 14px Microsoft YaHei')+5}
const ECHO_TUTORIAL_KEY='golden-scapegoat:echo-tutorial-v1';function hasSeenEchoTutorial(){try{return localStorage.getItem(ECHO_TUTORIAL_KEY)==='1'}catch(_){return false}}function markEchoTutorialSeen(){try{localStorage.setItem(ECHO_TUTORIAL_KEY,'1')}catch(_){}}function setEchoTutorialVideo(playing){const video=document.querySelector('#echoTutorialVideo');if(!video)return;if(playing)video.play().catch(()=>{});else video.pause()}function updateWinModal(){const won=s.status==='win',modal=document.querySelector('#winModal'),echoModal=document.querySelector('#echoTutorialModal'),showEchoTutorial=won&&C.echoTutorial===true&&!hasSeenEchoTutorial();modal.hidden=!won||showEchoTutorial;if(won)document.querySelector('#winSteps').textContent=`本关共使用 ${s.step} 步`;if(echoModal){echoModal.hidden=!showEchoTutorial;setEchoTutorialVideo(showEchoTutorial)};}
function draw(){x.clearRect(0,0,VIEW_W,VIEW_H);const bg=x.createLinearGradient(0,0,VIEW_W,VIEW_H);bg.addColorStop(0,'#17315d');bg.addColorStop(1,'#060913');x.fillStyle=bg;x.fillRect(0,0,VIEW_W,VIEW_H);x.fillStyle='#f0f5ff';x.font='900 23px Microsoft YaHei';x.fillText(`第 ${C.level} 关 · ${C.name}`,OX,42);x.fillStyle='#a9bde1';x.font='500 13px Microsoft YaHei';x.fillText(C.subtitle,OX,66);MAP.forEach((r,y)=>[...r].forEach((c,gx)=>tile(OX+gx*Z,OY+y*Z,c)));s.boxes.forEach(crate);entity(s.p);
 const sx=28,pw=COMPACT_LAYOUT?Math.max(330,OX-66):610,inner=pw-28;if(COMPACT_LAYOUT){panel(sx,100,pw,290,'实时验证');stat(sx+14,142,'替罪芙','本关未启用','#a9bde1',inner);stat(sx+14,205,'钥匙',keys.length?`${s.keys.filter(Boolean).length} / ${keys.length}　${gotAllKeys()?'✓':'✕'}`:'本关无钥匙',gotAllKeys()?'#7cf5bb':'#ffca8c',inner);stat(sx+14,268,'压板',plates.length?`${pressed()} / ${plates.length}　${platesReady()?'✓':'✕'}`:'本关无压板',platesReady()?'#7cf5bb':'#ffca8c',inner);panel(sx,405,pw,165,'通关目标');x.fillStyle='#a9ffd5';x.font='900 15px Microsoft YaHei';x.fillText('抵达 Exit',sx+14,460);textLines('深色砖块：墙壁；绿色 EXIT：出口。',sx+14,505,inner,18,'#c7b0e6','700 13px Microsoft YaHei')}else{panel(sx,101,610,270,'实时验证');stat(sx+18,150,'替罪芙','本关未启用','#a9bde1',574);stat(sx+18,220,'钥匙',keys.length?`${s.keys.filter(Boolean).length} / ${keys.length}　${gotAllKeys()?'✓':'✕'}`:'本关无钥匙',gotAllKeys()?'#7cf5bb':'#ffca8c',574);stat(sx+18,290,'压板',plates.length?`${pressed()} / ${plates.length}　${platesReady()?'✓':'✕'}`:'本关无压板',platesReady()?'#7cf5bb':'#ffca8c',574);goalPanel(sx,394,610);tutorialInfo(sx,540,610)}const status=s.status==='win'?'已验证通关':s.status==='fail'?'失败':'进行中';badge.innerHTML=`<strong>第 ${s.step} 步 · ${status}</strong>`;updateWinModal()}
function verify(){const errors=[];if(!MAP.every(r=>r.length===W))errors.push('地图宽度不一致');if(!start||!exit)errors.push('缺少起点或出口');let held=s;s=fresh();for(const name of SOL){if(!move(name,true)){errors.push(`标准答案在第 ${s.step+1} 步失效`);break;}}if(s.status!=='win')errors.push('标准答案无法通关');s=held;if(errors.length)throw new Error(`第 ${C.level} 关校验失败：${errors.join('；')}`);console.info(`第 ${C.level} 关校验通过：${SOL.length} 步。`)}
function goNext(){if(s.status!=='win')return;if(window.parent!==window){window.parent.postMessage({type:'golden-scapegoat-open-next',level:C.level},MESSAGE_ORIGIN);return;}location.href=C.level>=12?'../index.html':(C.next||`level-${C.level+1}.html`)}
document.addEventListener('keydown',e=>{if(DIR[e.key]){e.preventDefault();move(e.key)}if(e.key==='r'||e.key==='R')reset();if(e.key==='z'||e.key==='Z')undo();if(e.key==='h'||e.key==='H')hint()});
document.querySelector('#undo').onclick=undo;document.querySelector('#hint').onclick=hint;document.querySelector('#reset').onclick=reset;document.querySelector('#winRestart').onclick=reset;document.querySelector('#winNext').onclick=goNext;const echoTutorialContinue=document.querySelector('#echoTutorialContinue');if(echoTutorialContinue)echoTutorialContinue.onclick=()=>{markEchoTutorialSeen();goNext()};fu.onload=draw;verify();draw();
})();
