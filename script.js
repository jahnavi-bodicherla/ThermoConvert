/* ThermoLab — Application Logic */

/* ===========================
   STATE
=========================== */
let MODE = 'std';
let HIST = JSON.parse(localStorage.getItem('tl-hist') || '[]');
let FAVS = JSON.parse(localStorage.getItem('tl-favs') || '[]');
let LAST = null;
let HIST_OPEN = false;
let FAV_OPEN = false;
let LISTENING = false;
let REC = null;

const SYM = {C:'°C', F:'°F', K:'K'};
const NAMES = {C:'Celsius', F:'Fahrenheit', K:'Kelvin'};
const FORMULAS = {
  CC:'Same unit — no conversion needed',
  CF:'°F = (°C × 9⁄5) + 32',
  CK:'K = °C + 273.15',
  FC:'°C = (°F − 32) × 5⁄9',
  FF:'Same unit — no conversion needed',
  FK:'K = (°F − 32) × 5⁄9 + 273.15',
  KC:'°C = K − 273.15',
  KF:'°F = (K − 273.15) × 9⁄5 + 32',
  KK:'Same unit — no conversion needed'
};
const REF_C = {abs:-273.15, freeze:0, body:37, boil:100, lava:1200, sun:5500};

/* ===========================
   CONVERSION
=========================== */
function toC(v, u){ return u==='C'?v : u==='F'?(v-32)*5/9 : v-273.15; }
function fromC(v, u){ return u==='C'?v : u==='F'?v*9/5+32 : v+273.15; }
function conv(v, f, t){ return fromC(toC(v, f), t); }

/* ===========================
   VALIDATION
=========================== */
function validate(raw, unit) {
  if(raw===''||raw===null||raw===undefined) return 'Please enter a temperature value.';
  if(isNaN(raw)) return 'Not a valid number. Try something like 100 or −40.';
  const c = toC(parseFloat(raw), unit);
  if(c < -273.15) return `Below absolute zero (${unit==='K'?'0 K':unit==='F'?'−459.67 °F':'−273.15 °C'})! Physically impossible.`;
  return null;
}

/* ===========================
   MAIN CONVERT
=========================== */
function handleConvert(e) {
  if(e && e.clientX !== undefined) addRipple(e);
  const btn = document.getElementById('cbtn');
  btn.style.opacity = '0.7';
  btn.textContent = 'Converting…';
  setTimeout(()=>{
    btn.style.opacity = '';
    btn.textContent = 'Convert Temperature →';
    doConvert();
  }, 220);
}

function doConvert() {
  const raw = document.getElementById('tinput').value.trim();
  const from = document.getElementById('from-u').value;
  const to   = document.getElementById('to-u').value;
  const inp  = document.getElementById('tinput');

  const err = validate(raw, from);
  if(err) {
    inp.classList.add('err'); inp.classList.remove('ok');
    showErr(err);
    hideResult();
    return;
  }
  clearErr();
  inp.classList.remove('err'); inp.classList.add('ok');

  const val = parseFloat(raw);
  const result = conv(val, from, to);
  const celsius = toC(val, from);
  const p = parseInt(document.getElementById('prec').value);

  showResult(val, result, from, to, p);
  updateChips(celsius, p);
  updateThermo(celsius);
  updateZones(celsius);
  updateRefs(to, p);

  LAST = {val, result, from, to, celsius, p};
  addHistory(val, result, from, to, p);
  toast('Converted! ✓', 's');
}

/* ===========================
   RESULT UI
=========================== */
function showResult(val, res, from, to, p) {
  document.getElementById('res-ph').style.display = 'none';
  const rc = document.getElementById('res-content');
  rc.style.display = 'block';
  document.getElementById('res-box').classList.add('lit');
  document.getElementById('res-val').textContent = `${res.toFixed(p)} ${SYM[to]}`;
  document.getElementById('res-lbl').textContent = `${val} ${SYM[from]} → ${NAMES[to]}`;
  document.getElementById('res-fml').textContent = FORMULAS[from+to] || '';
  document.getElementById('all-u').classList.add('show');
}

function hideResult() {
  document.getElementById('res-ph').style.display = '';
  document.getElementById('res-content').style.display = 'none';
  document.getElementById('res-box').classList.remove('lit');
  document.getElementById('all-u').classList.remove('show');
}

/* ===========================
   CHIPS
=========================== */
function updateChips(celsius, p) {
  document.getElementById('chip-c').textContent = celsius.toFixed(p) + ' °C';
  document.getElementById('chip-f').textContent = fromC(celsius,'F').toFixed(p) + ' °F';
  document.getElementById('chip-k').textContent = fromC(celsius,'K').toFixed(p) + ' K';
}

/* ===========================
   THERMOMETER
=========================== */
function updateThermo(celsius) {
  const minC=-60, maxC=200;
  const clamped = Math.max(minC, Math.min(maxC, celsius));
  const pct = (clamped - minC)/(maxC - minC);
  const tubeH = 158, tubeTop = 18;
  const fillH = pct * tubeH;
  const fillY = tubeTop + (tubeH - fillH);
  const m = document.getElementById('mercury');
  m.setAttribute('y', fillY.toFixed(1));
  m.setAttribute('height', fillH.toFixed(1));

  const z = getZone(celsius);
  const badge = document.getElementById('badge');
  badge.textContent = `${z.label} · ${celsius.toFixed(1)}°C`;
  badge.style.background = z.bg;
  badge.style.color = z.color;
  badge.style.border = `1px solid ${z.border}`;
}

/* ===========================
   ZONES
=========================== */
const ZONE_IDS = ['z-abszero','z-freeze','z-cold','z-cool','z-warm','z-hot'];
function getZone(c) {
  if(c<=-273.15) return {id:'z-abszero',label:'Absolute Zero',color:'#8B5CF6',bg:'rgba(139,92,246,0.15)',border:'rgba(139,92,246,0.4)'};
  if(c<0)        return {id:'z-freeze',label:'🧊 Freezing',color:'#06B6D4',bg:'rgba(6,182,212,0.15)',border:'rgba(6,182,212,0.4)'};
  if(c<10)       return {id:'z-cold',label:'🥶 Cold',color:'#3B82F6',bg:'rgba(59,130,246,0.15)',border:'rgba(59,130,246,0.4)'};
  if(c<20)       return {id:'z-cool',label:'😌 Cool',color:'#10B981',bg:'rgba(16,185,129,0.15)',border:'rgba(16,185,129,0.4)'};
  if(c<30)       return {id:'z-warm',label:'🌤️ Moderate',color:'#F59E0B',bg:'rgba(245,158,11,0.15)',border:'rgba(245,158,11,0.4)'};
  return          {id:'z-hot',label:'🔥 Hot',color:'#EF4444',bg:'rgba(239,68,68,0.15)',border:'rgba(239,68,68,0.4)'};
}
function updateZones(celsius) {
  const z = getZone(celsius);
  ZONE_IDS.forEach(id=>{
    const el = document.getElementById(id);
    el.classList.remove('active','inactive');
    if(id===z.id){ el.classList.add('active'); }
    else { el.classList.add('inactive'); }
  });
}

/* ===========================
   REFERENCE PANEL
=========================== */
function updateRefs(unit, p) {
  for(const[k,c] of Object.entries(REF_C)) {
    const el = document.getElementById('ref-'+k);
    if(el) el.textContent = fromC(c, unit).toFixed(p) + ' ' + SYM[unit];
  }
}

/* ===========================
   PRECISION
=========================== */
document.getElementById('prec').addEventListener('input', function(){
  document.getElementById('prec-val').textContent = this.value;
  if(LAST) {
    const p = parseInt(this.value);
    showResult(LAST.val, LAST.result, LAST.from, LAST.to, p);
    updateChips(LAST.celsius, p);
    updateRefs(LAST.to, p);
    LAST.p = p;
  }
});

/* ===========================
   MODE
=========================== */
function setMode(m) {
  MODE = m;
  document.getElementById('mbtn-std').classList.toggle('on', m==='std');
  document.getElementById('mbtn-live').classList.toggle('on', m==='live');
  document.getElementById('mbtn-std').setAttribute('aria-pressed', m==='std');
  document.getElementById('mbtn-live').setAttribute('aria-pressed', m==='live');
  document.getElementById('cbtn').style.display = m==='live' ? 'none' : '';
  toast(m==='live'?'🔴 Live mode — converts as you type':'⚡ Standard mode','i');
}

// Live mode listener
document.getElementById('tinput').addEventListener('input', ()=>{
  if(MODE==='live') {
    const v = document.getElementById('tinput').value;
    if(v!=='') doConvert();
    else { hideResult(); clearErr(); document.getElementById('tinput').classList.remove('ok','err'); }
  }
});
document.getElementById('from-u').addEventListener('change', ()=>{
  if(MODE==='live' && document.getElementById('tinput').value) doConvert();
  if(LAST) updateRefs(document.getElementById('to-u').value, LAST.p);
});
document.getElementById('to-u').addEventListener('change', ()=>{
  if(MODE==='live' && document.getElementById('tinput').value) doConvert();
  if(LAST) updateRefs(document.getElementById('to-u').value, LAST.p);
});

/* ===========================
   SWAP
=========================== */
function swapUnits() {
  const f = document.getElementById('from-u');
  const t = document.getElementById('to-u');
  const tmp = f.value; f.value = t.value; t.value = tmp;
  if(MODE==='live' && document.getElementById('tinput').value) doConvert();
  toast('Units swapped ⇄','i');
}

/* ===========================
   COPY
=========================== */
function copyResult() {
  if(!LAST){ toast('Nothing to copy yet','e'); return; }
  const txt = `${LAST.val} ${SYM[LAST.from]} = ${LAST.result.toFixed(LAST.p)} ${SYM[LAST.to]}`;
  if(navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(()=>toast('Copied to clipboard! 📋','s')).catch(()=>fallbackCopy(txt));
  } else { fallbackCopy(txt); }
}
function fallbackCopy(txt) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.cssText='position:fixed;opacity:0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('Copied! 📋','s'); }
  catch(e){ toast('Copy failed','e'); }
  document.body.removeChild(ta);
}

/* ===========================
   SPEAK
=========================== */
function speakResult() {
  if(!LAST){ toast('Nothing to read yet','e'); return; }
  if(!window.speechSynthesis){ toast('Speech not supported','e'); return; }
  window.speechSynthesis.cancel();
  const u = {C:'Celsius',F:'Fahrenheit',K:'Kelvin'};
  const txt = `${LAST.val} degrees ${u[LAST.from]} equals ${LAST.result.toFixed(LAST.p)} ${u[LAST.to]}`;
  const utt = new SpeechSynthesisUtterance(txt);
  utt.rate = 0.95; utt.pitch = 1;
  window.speechSynthesis.speak(utt);
  toast('🔊 Reading result…','i');
}

/* ===========================
   FAVOURITES
=========================== */
function saveToFav() {
  if(!LAST){ toast('Nothing to save yet','e'); return; }
  const p = LAST.p;
  const entry = {
    id: Date.now(),
    label:`${LAST.val} ${SYM[LAST.from]} → ${LAST.result.toFixed(p)} ${SYM[LAST.to]}`,
    formula: FORMULAS[LAST.from+LAST.to]||'',
    time: new Date().toLocaleString()
  };
  FAVS.unshift(entry);
  if(FAVS.length>50) FAVS.pop();
  localStorage.setItem('tl-favs', JSON.stringify(FAVS));
  renderFavs();
  // Show fav panel if not open
  if(!FAV_OPEN) {
    FAV_OPEN = true;
    document.getElementById('fav-panel').style.display = 'block';
  }
  toast('⭐ Saved to favourites!','s');
}
function clearFavs() {
  FAVS = [];
  localStorage.setItem('tl-favs', JSON.stringify(FAVS));
  renderFavs();
  toast('Favourites cleared','i');
}
function renderFavs() {
  const el = document.getElementById('fav-list');
  if(!FAVS.length){ el.innerHTML='<div class="hempty">No favourites saved yet.</div>'; return; }
  el.innerHTML = FAVS.map(f=>`
    <div class="hi" role="listitem">
      <div>
        <div class="hconv">${f.label}</div>
        <div class="hmeta">${f.formula}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="htime">${f.time}</div>
        <button class="hdel" onclick="delFav(${f.id})" aria-label="Remove">✕</button>
      </div>
    </div>`).join('');
}
function delFav(id){ FAVS=FAVS.filter(f=>f.id!==id); localStorage.setItem('tl-favs',JSON.stringify(FAVS)); renderFavs(); }

/* ===========================
   HISTORY
=========================== */
function addHistory(val, result, from, to, p) {
  const entry = {
    id: Date.now(),
    val, result, from, to, p,
    time: new Date().toLocaleString()
  };
  HIST.unshift(entry);
  if(HIST.length > 200) HIST.pop();
  localStorage.setItem('tl-hist', JSON.stringify(HIST));
  if(HIST_OPEN) renderHist();
}
function renderHist(filter='') {
  const el = document.getElementById('hlist');
  const filtered = HIST.filter(h=>{
    const s = `${h.val}${SYM[h.from]}${h.result.toFixed(h.p)}${SYM[h.to]}`.toLowerCase();
    return s.includes(filter.toLowerCase());
  });
  if(!filtered.length){
    el.innerHTML=`<div class="hempty">${filter?'No matches found.':'No conversions yet.'}</div>`;
    return;
  }
  el.innerHTML = filtered.map(h=>`
    <div class="hi" role="listitem">
      <div>
        <div class="hconv">${h.val} ${SYM[h.from]} → ${h.result.toFixed(h.p)} ${SYM[h.to]}</div>
        <div class="hmeta">${FORMULAS[h.from+h.to]||''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="htime">${h.time}</div>
        <button class="hdel" onclick="delHist(${h.id})" aria-label="Delete">✕</button>
      </div>
    </div>`).join('');
}
function delHist(id){ HIST=HIST.filter(h=>h.id!==id); localStorage.setItem('tl-hist',JSON.stringify(HIST)); renderHist(document.getElementById('hsearch').value); }
function clearHistory(){ HIST=[]; localStorage.setItem('tl-hist',JSON.stringify(HIST)); renderHist(); toast('History cleared','i'); }
function filterHist(){ renderHist(document.getElementById('hsearch').value); }
function toggleHistory(){
  HIST_OPEN = !HIST_OPEN;
  const panel = document.getElementById('hist-panel');
  panel.style.display = HIST_OPEN ? 'block' : 'none';
  document.getElementById('btn-hist').classList.toggle('active-btn', HIST_OPEN);
  if(HIST_OPEN) renderHist();
  toast(HIST_OPEN?'History opened 🕐':'History closed','i');
}

/* ===========================
   EXPORT
=========================== */
function exportHistory(fmt) {
  if(!HIST.length){ toast('No history to export','e'); return; }
  let content, filename, type;
  if(fmt==='csv'){
    const rows = HIST.map(h=>`${h.val},${SYM[h.from]},${h.result.toFixed(h.p)},${SYM[h.to]},"${h.time}"`);
    content = ['From Value,From Unit,To Value,To Unit,Time',...rows].join('\n');
    filename='thermolab-history.csv'; type='text/csv';
  } else {
    content = JSON.stringify(HIST.map(h=>({
      from:`${h.val} ${SYM[h.from]}`,
      to:`${h.result.toFixed(h.p)} ${SYM[h.to]}`,
      formula:FORMULAS[h.from+h.to]||'',
      time:h.time
    })),null,2);
    filename='thermolab-history.json'; type='application/json';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content],{type}));
  a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exported as ${fmt.toUpperCase()} ⬇️`,'s');
}

/* ===========================
   VOICE INPUT
=========================== */
function toggleVoice() {
  if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)){
    toast('Voice input not supported in this browser','e'); return;
  }
  if(LISTENING){
    if(REC){ try{ REC.stop(); }catch(e){} }
    stopListening(); return;
  }
  LISTENING = true;
  const btn = document.getElementById('btn-voice');
  btn.textContent = '🔴';
  btn.classList.add('recording');
  btn.querySelector('.tip').textContent = 'Tap to stop';

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  REC = new SR();
  REC.lang = 'en-US';
  REC.interimResults = false;
  REC.maxAlternatives = 1;
  toast('🎙️ Listening… speak a temperature','i');

  REC.onresult = (e) => {
    const spoken = e.results[0][0].transcript;
    // extract number, support negatives
    const match = spoken.match(/-?\d+(\.\d+)?/);
    if(match){
      const num = match[0];
      document.getElementById('tinput').value = num;
      toast(`Heard: "${spoken}" → ${num}`,'s');
      if(MODE==='live') doConvert();
    } else {
      toast(`Didn't catch a number. Heard: "${spoken}"`,'e');
    }
    stopListening();
  };
  REC.onerror = (e) => { toast(`Voice error: ${e.error}`,'e'); stopListening(); };
  REC.onend = () => { if(LISTENING) stopListening(); };
  REC.start();
}
function stopListening(){
  LISTENING = false; REC = null;
  const btn = document.getElementById('btn-voice');
  btn.textContent = '🎙️';
  btn.classList.remove('recording');
  btn.querySelector('.tip').textContent = 'Voice Input (V)';
}

/* ===========================
   THEME
=========================== */
function toggleTheme(){
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme', dark?'light':'dark');
  document.getElementById('btn-theme').textContent = dark?'☀️':'🌙';
  document.getElementById('btn-theme').querySelector('.tip').textContent = dark?'Dark Mode (T)':'Light Mode (T)';
  localStorage.setItem('tl-theme', dark?'light':'dark');
  toast(dark?'☀️ Light mode':'🌙 Dark mode','i');
}

/* ===========================
   RESET
=========================== */
function resetForm(){
  document.getElementById('tinput').value='';
  document.getElementById('tinput').classList.remove('err','ok');
  clearErr();
  hideResult();
  // reset thermo
  const m = document.getElementById('mercury');
  m.setAttribute('y','176'); m.setAttribute('height','0');
  const badge = document.getElementById('badge');
  badge.textContent='Enter a temperature';
  badge.style.cssText='background:rgba(124,58,237,0.14);color:#9B59F8;border:1px solid rgba(124,58,237,0.3)';
  ZONE_IDS.forEach(id=>{ const el=document.getElementById(id); el.classList.remove('active','inactive'); });
  LAST = null;
  toast('Form reset','i');
}
function resetAll(){
  resetForm();
  document.getElementById('from-u').value='C';
  document.getElementById('to-u').value='K';
  document.getElementById('prec').value=2;
  document.getElementById('prec-val').textContent='2';
  setMode('std');
  // close panels
  if(HIST_OPEN){ HIST_OPEN=false; document.getElementById('hist-panel').style.display='none'; document.getElementById('btn-hist').classList.remove('active-btn'); }
  updateRefs('K',2);
  toast('Everything reset ↺','i');
}

/* ===========================
   ERRORS
=========================== */
function showErr(msg){
  const el=document.getElementById('errmsg');
  document.getElementById('errtxt').textContent=msg;
  el.classList.add('show');
}
function clearErr(){
  document.getElementById('errmsg').classList.remove('show');
}

/* ===========================
   RIPPLE
=========================== */
function addRipple(e){
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  r.className='rpl';
  const size = Math.max(btn.clientWidth, btn.clientHeight);
  r.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend',()=>r.remove());
}

/* ===========================
   TOAST
=========================== */
function toast(msg, type='i'){
  const c=document.getElementById('toasts');
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  const icons={s:'✅',i:'ℹ️',e:'❌'};
  t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(20px)'; setTimeout(()=>t.remove(),300); },3000);
}

/* ===========================
   KEYBOARD
=========================== */
document.addEventListener('keydown', e=>{
  const tag = document.activeElement.tagName;
  const isInput = tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA';
  if(isInput){
    if(e.key==='Enter'){ e.preventDefault(); if(MODE==='std') handleConvert({}); }
    if(e.key==='Escape'){ document.activeElement.blur(); resetForm(); }
    return;
  }
  switch(e.key){
    case 'Enter': handleConvert({}); break;
    case 'Escape': resetForm(); break;
    case 't': case 'T': toggleTheme(); break;
    case 's': case 'S': swapUnits(); break;
    case 'v': case 'V': toggleVoice(); break;
    case 'h': case 'H': toggleHistory(); break;
    case 'r': case 'R': resetAll(); break;
  }
});

/* ===========================
   INIT
=========================== */
(function init(){
  // Theme
  const saved = localStorage.getItem('tl-theme') || (window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');
  document.documentElement.setAttribute('data-theme',saved);
  document.getElementById('btn-theme').textContent = saved==='dark'?'🌙':'☀️';

  // Reference panel default (Kelvin)
  updateRefs('K', 2);

  // Render existing history/favs
  renderHist();
  renderFavs();

  toast('ThermoLab ready 🌡️','s');
})();
