// Small browser compatibility boundary. Rendering and UI are native tvOS APIs.
var window=globalThis, nativeAxis=0, nativeNow=0, innerWidth=1920, innerHeight=1080, devicePixelRatio=1;
var performance={now:()=>nativeNow}, listeners={}, raf=null, timers=[], nextTimer=1;
function addEventListener(k,f){(listeners[k] ||= []).push(f)}
function dispatch(k,e={}){e.preventDefault=()=>{}; (listeners[k]||[]).forEach(f=>f(e))}
function requestAnimationFrame(f){raf=f}
function setTimeout(f,ms=0){let id=nextTimer++;timers.push({id,f,at:nativeNow+ms,ms:0});return id}
function setInterval(f,ms){let id=nextTimer++;timers.push({id,f,at:nativeNow+ms,ms});return id}
function clearTimeout(id){timers=timers.filter(t=>t.id!==id)}
var clearInterval=clearTimeout;
function nativeFrame(now){nativeNow=now; const due=timers.filter(t=>t.at<=now);due.forEach(t=>{if(t.ms)t.at=now+t.ms;else clearTimeout(t.id);t.f()});let f=raf;raf=null;if(f)f(now)}
var navigator={userAgent:'Beanbound Native tvOS',getGamepads:()=>[{connected:true,axes:[nativeAxis,0],buttons:Array.from({length:16},()=>({pressed:false}))}]};
var location={search:'?tv=1'}, history={pushState:()=>{}}, matchMedia=()=>({matches:false,addEventListener:()=>{}});
var localStorage={getItem:k=>nativeRead(k),setItem:(k,v)=>nativeWrite(k,String(v)),removeItem:k=>nativeRemove(k)};
class Classes {
 constructor(s=''){this.set=new Set(s.split(/\s+/).filter(Boolean))}
 contains(s){return this.set.has(s)} add(...s){s.forEach(x=>this.set.add(x))} remove(...s){s.forEach(x=>this.set.delete(x))}
 toggle(s,on){let v=on===undefined?!this.contains(s):on;v?this.add(s):this.remove(s);return v}
}
var nodes={};
function strip(s){return String(s).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ')}
class Element {
 constructor(n={tag:'div',attrs:{},text:'',children:[]},p=null){
  this.tagName=n.tag.toUpperCase();this.attrs=n.attrs;this.id=n.attrs.id||'';this.parent=p;this.ownText=n.text;this.children=[];
  this.classList=new Classes(n.attrs.class||'');this.style={setProperty:()=>{}};this.events={};this.hidden='hidden' in n.attrs;this.disabled=false;
  this.scrollTop=0;this.clientHeight=1080;this.scrollHeight=1080;this.width=320;this.height=320;
  if(this.id)nodes[this.id]=this;this.children=n.children.map(x=>new Element(x,this));
 }
 get textContent(){return this.ownText+this.children.map(c=>c.textContent).join(' ')}
 set textContent(v){this.ownText=String(v);this.children=[]}
 get innerHTML(){return this.textContent} set innerHTML(v){this.textContent=strip(v)}
 set className(v){this.classList=new Classes(v)}
 addEventListener(k,f){(this.events[k] ||= []).push(f)}
 setAttribute(k,v){this.attrs[k]=v} getAttribute(k){return this.attrs[k]||null}
 appendChild(c){c.parent=this;this.children.push(c);return c}
 contains(c){return c===this||this.children.some(x=>x.contains(c))}
 closest(sel){return (sel==='.overlay'&&this.classList.contains('overlay'))?this:this.parent?.closest(sel)}
 querySelectorAll(sel){let r=[];for(let c of this.children){if(sel==='button'&&c.tagName==='BUTTON')r.push(c);r.push(...c.querySelectorAll(sel))}return r}
 getClientRects(){return this.visible()?[this.getBoundingClientRect()]:[]}
 visible(){return !this.hidden&&!this.classList.contains('hidden')&&(!this.parent||this.parent.visible())}
 getBoundingClientRect(){let ov=this.closest('.overlay'),i=ov?ov.querySelectorAll('button').indexOf(this):0;return {left:0,top:i*80,width:600,height:60,bottom:i*80+60}}
 focus(){document.activeElement=this} blur(){document.activeElement=document.body}
 click(){(this.events.click||[]).forEach(f=>f({preventDefault:()=>{}}))}
 getContext(){if(!this.context)this.context=new Canvas(this.id==='c');return this.context}
 toDataURL(){throw new Error('Native canvas')}
}
var commands=[];
class Canvas {
 constructor(main){this.main=main;this.values={};return new Proxy(this,{set:(o,k,v)=>{o[k]=v;if(o.main&&typeof v!=='function')commands.push(['property',k,v]);return true}})}
 emit(k,...a){if(this.main)commands.push([k,...a])}
 createLinearGradient(...a){return {type:'linear',args:a,stops:[],addColorStop(p,c){this.stops.push([p,c])}}}
 createRadialGradient(...a){return {type:'radial',args:a,stops:[],addColorStop(p,c){this.stops.push([p,c])}}}
}
['arc','arcTo','beginPath','bezierCurveTo','clip','closePath','ellipse','fill','fillRect','fillText','lineTo','moveTo','quadraticCurveTo','rect','restore','rotate','roundRect','save','scale','setLineDash','setTransform','stroke','strokeRect','strokeText','translate','clearRect','drawImage'].forEach(k=>Canvas.prototype[k]=function(...a){this.emit(k,...a)});
Canvas.prototype.measureText=function(s){return {width:String(s).length*14}};
var tree=nativeDOM.map(n=>new Element(n));
Object.keys(nodes).forEach(id=>{if(!(id in globalThis))globalThis[id]=nodes[id]});
var document={getElementById:id=>nodes[id]||(nodes[id]=new Element({tag:'div',attrs:{id},text:'',children:[]})),
 createElement:tag=>new Element({tag,attrs:{},text:'',children:[]}),addEventListener,hidden:false,visibilityState:'visible',
 body:null,documentElement:null};
function findTag(ns,tag){for(let n of ns){if(n.tagName===tag)return n;let r=findTag(n.children,tag);if(r)return r}}
document.body=findTag(tree,'BODY');document.documentElement=findTag(tree,'HTML');document.activeElement=document.body;
function nativeKey(key,down){dispatch(down?'keydown':'keyup',{key,code:key,repeat:false})}
function nativeMenu(){let s=beanbound.snapshot(),n=nodes[s.overlay];return {snapshot:s,
 title:n?(n.children.flatMap(c=>c.children).find(c=>c.tagName==='H2')?.textContent||({start:'Beanbound',settings:'Settings & More',evos:'Evolutions',how:'How to play',pause:'Paused',over:nodes.overTitle.textContent})[s.overlay]||'Beanbound'):'',
 text:n?n.textContent.replace(/\s+/g,' ').trim():'',
 buttons:n?n.querySelectorAll('button').filter(b=>b.visible()&&!['tvToggle','hapticToggle','shareScore'].includes(b.id)).map(b=>({id:b.id,title:(b.textContent.trim()||b.attrs['aria-label']||b.id)+(b.attrs.role==='switch'?': '+(b.attrs['aria-checked']==='true'?'on':'off'): '')})):[]}}
class AudioParam {
 constructor(value=1){this.value=value;this.events=[]}
 setValueAtTime(v,t){this.value=v;this.events.push([t,v,'set'])}
 linearRampToValueAtTime(v,t){this.value=v;this.events.push([t,v,'linear'])}
 exponentialRampToValueAtTime(v,t){this.value=v;this.events.push([t,v,'exponential'])}
 setTargetAtTime(v){this.value=v}
}
class AudioNode {
 constructor(){this.outputs=[];this.gain=new AudioParam();this.frequency=new AudioParam(440);this.pan=new AudioParam(0);this.delayTime=new AudioParam(0);this.type='sine'}
 connect(n){this.outputs.push(n);return n} disconnect(){this.outputs=[]}
 start(t){this.started=t}
 stop(t){
  if(this.started===undefined||!this.oscillator)return;
  let gain=this.outputs[0]?.gain, events=gain?.events||[],peak=Math.max(...events.map(e=>e[1]),0.0001),attack=0;
  if(events.length>1&&events[0][1]<=0.0001)attack=events[1][0]-this.started;
  let seen=new Set(),master=1;
  function walk(n){if(!n||seen.has(n))return;seen.add(n);if(n.master)master=n.gain.value;n.outputs.forEach(walk)}
  this.outputs.forEach(walk);
  const fs=this.frequency.events;
  if(typeof nativeTone==='function')nativeTone(fs[0]?.[1]||this.frequency.value,fs.length>1?fs[fs.length-1][1]:fs[0]?.[1]||this.frequency.value,t-this.started,this.type,peak*master,attack,Math.max(0,this.started-nativeNow/1000));
 }
}
class AudioContext {
 constructor(){this.state='running';this.sampleRate=44100;this.destination=new AudioNode();this.destination.destination=true}
 get currentTime(){return nativeNow/1000}
 addEventListener(){} resume(){this.state='running';return Promise.resolve()} suspend(){this.state='suspended';return Promise.resolve()}
 createOscillator(){let n=new AudioNode();n.oscillator=true;return n}
 createGain(){let n=new AudioNode();let connect=n.connect;n.connect=function(dest){if(dest.destination)this.master=true;return connect.call(this,dest)};return n}
 createStereoPanner(){return new AudioNode()} createDelay(){return new AudioNode()}
 createBuffer(){return {getChannelData:()=>new Float32Array(4410)}}
 createBufferSource(){return new AudioNode()} createBiquadFilter(){return new AudioNode()}
}
// The game discovers Web Audio through window, whereas a class declaration
// alone creates a lexical binding rather than a property on globalThis.
globalThis.AudioContext=AudioContext;
// Transfer numeric drawing data in one typed buffer instead of thousands of
// individually bridged JavaScript arrays and NSNumber objects on the UI thread.
var nativeOps=['property','arc','arcTo','beginPath','bezierCurveTo','clip','closePath','ellipse','fill','fillRect','fillText','lineTo','moveTo','quadraticCurveTo','rect','restore','rotate','roundRect','save','scale','setLineDash','setTransform','stroke','strokeRect','strokeText','translate','clearRect','drawImage'];
var nativeOpCodes=new Map(nativeOps.map((op,i)=>[op,i]));
var nativePackedValues=[],nativePackedNumbers=new Float64Array(0),nativePackedLength=0;
function nativePackedFrame(now,axis){
 nativeAxis=axis;commands=[];nativeFrame(now);
 const needed=commands.length*20;
 if(nativePackedNumbers.length<needed)nativePackedNumbers=new Float64Array(needed*2);
 nativePackedValues=[];const ids=new Map();let cursor=0;
 for(const cmd of commands){
  nativePackedNumbers[cursor++]=nativeOpCodes.get(cmd[0]);nativePackedNumbers[cursor++]=cmd.length-1;
  for(let i=1;i<cmd.length;i++){
   const v=cmd[i];
   if(typeof v==='number'){nativePackedNumbers[cursor++]=0;nativePackedNumbers[cursor++]=v}
   else if(typeof v==='boolean'){nativePackedNumbers[cursor++]=2;nativePackedNumbers[cursor++]=v?1:0}
   else {
    let id=ids.get(v);
    if(id===undefined){id=nativePackedValues.length;ids.set(v,id);nativePackedValues.push(v?.stops?{type:v.type,args:v.args,stops:v.stops}:v)}
    nativePackedNumbers[cursor++]=1;nativePackedNumbers[cursor++]=id;
   }
  }
 }
 nativePackedLength=cursor;return nativePackedNumbers;
}
var nativeSpriteSources=new Map();
Canvas.prototype.nativeSprite=function(key,x,y,w,h,draw){
 if(!this.main){draw();return}
 let source=nativeSpriteSources.get(key);
 if(source===undefined){
  const outer=commands;commands=[['translate',-x,-y]];
  draw();source=JSON.stringify(commands);commands=outer;
  if(nativeSpriteSources.size>64)nativeSpriteSources.clear();
  nativeSpriteSources.set(key,source);
 }
 this.emit('sprite',key,x,y,w,h,source);
};
nativeOps.push('sprite');nativeOpCodes.set('sprite',nativeOps.length-1);
