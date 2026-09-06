(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["standalone:glue",523651,e=>{"use strict";e.v(t=>Promise.resolve(t(841685)))},990001,e=>{"use strict";
var React=e.i(741821),J=e.i(724225),DOM=e.i(376151),GPU=e.i(215453),Hero=e.i(951947).default;
function detector(A){
  var now=(A&&A.now)||Date.now();
  var isMobile=(window.matchMedia&&window.matchMedia("(hover: none) and (pointer: coarse)").matches)||navigator.maxTouchPoints>0;
  try{
    var q=new URLSearchParams(window.location.search).get("gpuTier");
    var ls=null;try{ls=window.localStorage.getItem("openai.gpuPerformance.override.v1")}catch(_){}
    var v=q!=null?q:ls;
    if(v==="0"||v==="1"||v==="2"||v==="3"){var t0=Number(v);
      return Promise.resolve({createdAt:now,isMobile:isMobile,source:"override",supportsWebGL:t0>0,tier:t0})}
  }catch(_){}
  function localProbe(src){
    var gl=null;
    try{gl=document.createElement("canvas").getContext("webgl2")||document.createElement("canvas").getContext("webgl")}catch(_){}
    if(gl)console.info("[standalone] "+src+"，按 WebGL 探测回退为 tier "+2);
    var supported=!!gl;
    if(gl){var lose=gl.getExtension('WEBGL_lose_context');if(lose)lose.loseContext();}
    return{createdAt:now,isMobile:isMobile,source:"fallback",supportsWebGL:supported,tier:supported?2:0};
  }
  // AITA 集成版只做本地 WebGL 能力探测，不请求外部基准资源。
  return Promise.resolve(localProbe("AITA 本地 WebGL 探测"));
}
function Bridge(){
  var requested=React.useRef(window.parent===window);
  var activeState=React.useState(requested.current&&!document.hidden),active=activeState[0],setActive=activeState[1];
  var qualityState=React.useState(1),quality=qualityState[0],setQuality=qualityState[1];
  var budget=React.useMemo(function(){return window.createAitaEffectBudget({onChange:setQuality})},[]);
  React.useEffect(function(){
    function sync(){setActive(requested.current&&!document.hidden)}
    function hide(){setActive(false)}
    function onMessage(event){
      if(event.source!==window.parent||!event.data||event.data.type!=="aita:output-cloud-active")return;
      requested.current=Boolean(event.data.active);sync();
    }
    window.addEventListener("message",onMessage);
    document.addEventListener("visibilitychange",sync);
    window.addEventListener("pagehide",hide);
    window.addEventListener("pageshow",sync);
    return function(){window.removeEventListener("message",onMessage);document.removeEventListener("visibilitychange",sync);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",sync)};
  },[]);
  var s=GPU.useGpuPerformance(),profile=s.profile,status=s.status;
  var r=GPU.useRendererProfile();
  React.useEffect(function(){
    document.body.dataset.active=String(active);
    budget.reset();
    if(!active||!profile||profile.source==='override')return;
    var request=0;
    function measure(now){budget.sample(now);request=requestAnimationFrame(measure)}
    request=requestAnimationFrame(measure);
    return function(){cancelAnimationFrame(request);budget.reset()};
  },[active,profile,budget]);
  var adaptive=React.useMemo(function(){
    if(profile&&profile.source==='override')return r;
    return Object.assign({},r,{
      getDpr:function(){return [1,Math.min(r.getDpr()[1],[1,1.25,1.5][quality])]},
      getMaxParticleCount:function(){return Math.min(r.getMaxParticleCount(),[12000,28000,40000][quality])},
      getPostprocessing:function(){return quality===0?'none':'selective'}
    });
  },[r,quality,profile]);
  React.useEffect(function(){document.body.dataset.quality=String(quality)},[quality]);
  if(!profile&&status!=="error")return null;
  if(!r.canUseWebGL())return J.jsx("div",{style:{color:"#888",font:"14px system-ui",display:"grid",placeItems:"center",height:"100%"},children:"WebGL 不可用，无法渲染粒子云"});
  return J.jsx(Hero,{active:active,profile:adaptive});
}
var el=document.getElementById("hero-root");
DOM.createRoot(el).render(J.jsx(GPU.GpuPerformanceProvider,{detector:detector,children:J.jsx(Bridge,{})}));
var readyObserver=new MutationObserver(function(){
  var cloud=el.querySelector("[data-particle-count]");
  if(!cloud||Number(cloud.getAttribute("data-particle-count"))<=0)return;
  readyObserver.disconnect();
  requestAnimationFrame(function(){window.parent.postMessage("aita:output-cloud-ready","*")});
});
readyObserver.observe(el,{attributes:true,attributeFilter:["data-particle-count"],childList:true,subtree:true});
console.info("[standalone] CloudMeshHero 已挂载，等待 GPU 检测与粒子成形…");
}]);
// 入口描述符：非数组 push，runtime 会以此为信号实例化引导模块（与 Next 客户端入口同一机制）
(globalThis.TURBOPACK).push({otherChunks:[],runtimeModuleIds:[990001]});
