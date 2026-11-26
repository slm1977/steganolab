'use strict';
const $ = id => document.getElementById(id);
const C = Stegano, canvas = $('canvas'), reference = $('reference');
let generatedPair = null;
let original = null, suspect = null, mask = null, bits = '', selected = [0, 0];
let bitSources = [];
let mode = 'mission', step = 0, autoFit = true, zoom = 1, planeBuffer = null;
const generation = {original: 0, suspect: 0, mask: 0};
const tabs = [$('tab-analysis'), $('tab-encoder')], panels = [$('analysis'), $('encoder')];
const say = text => { $('status').textContent = text; $('encstatus').textContent = text; };
const comparable = () => !!(original && suspect && original.width === suspect.width && original.height === suspect.height);
const current = () => $('view').value === 'original' && original ? original : suspect || original;
function artifact(data, width, height, hasAlpha, name) {
  let hasTransparency = false;
  if (hasAlpha) for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { hasTransparency = true; break; }
  return {data, width, height, hasAlpha, hasTransparency, colorType: hasAlpha ? 6 : 2, bitDepth: 8, name};
}
function describe(item) {
  return `${item.name} · ${item.width} × ${item.height} · PNG ${item.hasAlpha ? 'RGBA' : 'RGB'} · ${item.bitDepth} bit/canale · ${item.hasAlpha ? 32 : 24} bit/pixel · ${item.hasAlpha ? 32 : 24} piani · ${item.hasAlpha ? 'alfa presente' : 'alfa assente (255 implicito)'} · ${item.hasTransparency ? 'trasparenza presente' : 'nessuna trasparenza effettiva'}`;
}
function download(blob, name) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function downloadPng(item, name) { download(new Blob([PngCodec.encode(item)], {type: 'image/png'}), name); }
function state(id, text) { $(id + 'state').textContent = text; }
function invalidate(...slots) { for (const slot of slots) generation[slot]++; }
function showBits() {
  const el = $('bits'); el.replaceChildren(); $('bitsummary').textContent = `${bits.length} bit raccolti · ${Math.floor(bits.length / 8)} byte completi${bits.length % 8 ? ' · ' + (bits.length % 8) + ' bit residui' : ''}`;
  let byteIndex = 0;
  for (const group of bits.slice(0, 512).match(/.{1,8}/g) || []) {
    const row = document.createElement('div'); row.className = 'byte';
    const sources = bitSources.slice(byteIndex * 8, byteIndex * 8 + group.length);
    const coords = [...new Set(sources.map(p => `(${p.x}, ${p.y})`))];
    const label = document.createElement('div'); label.className = 'byte-source'; label.textContent = `${++byteIndex}. ${coords.join(' · ')}`; label.title = sources.map((p,i) => `Bit ${7-i}: (${p.x}, ${p.y}) · ${p.channel} · posizione ${p.bit}`).join('\n'); el.append(label);
    for (let i = 0; i < 8; i++) { const cell = document.createElement('span'); cell.textContent = group[i] ?? '·'; row.append(cell); }
    const val = document.createElement('small'); val.textContent = group.length === 8 ? ' = ' + parseInt(group, 2) : ''; row.append(val); el.append(row);
  }
  if (bits.length > 512) el.append('… anteprima dei primi 512 bit'); $('decoded').textContent = '';
}
function reset() { step = 0; guide(); bits = ''; bitSources = []; selected = [0, 0]; $('notes').value = ''; showBits(); }
function setMode(next, preserve = false) {
  if (mode === next && !preserve) return;
  invalidate('original', 'suspect'); mode = next;
  document.querySelector(`input[name="mode"][value="${next}"]`).checked = true;
  $('missioncontrols').hidden = next !== 'mission'; $('manualcontrols').hidden = next !== 'manual';
  if (!preserve) { generatedPair = null; original = null; suspect = null; state('original', 'Nessun file selezionato.'); state('suspect', 'Nessun file selezionato.'); state('cover', 'Nessuna immagine originale caricata.'); $('brief').textContent = next === 'manual' ? 'Carica uno o entrambi i reperti.' : 'Scegli e avvia una missione.'; }
  else { state('original', original ? describe(original) : 'Nessun originale.'); state('suspect', suspect ? describe(suspect) : 'Nessuna sospetta.'); }
  reset(); autoFit = true; say(''); render();
}
document.querySelectorAll('input[name="mode"]').forEach(r => r.onchange = () => setMode(r.value));
async function loadFile(id, slot, file) {
  if (!file) return; const token = ++generation[slot], stateId = id === 'coverfile' ? 'cover' : id === 'maskfile' ? 'mask' : id;
  if (slot === 'original') { generatedPair = null; original = null; state(id === 'coverfile' ? 'original' : 'cover', 'Nessuna immagine originale caricata.'); if (id === 'coverfile') { invalidate('suspect'); suspect = null; state('suspect', 'Nessuna sospetta.'); } }
  else if (slot === 'suspect') { generatedPair = null; suspect = null; } else mask = null;
  state(stateId, `Caricamento: ${file.name}…`);
  if (slot !== 'mask') { reset(); autoFit = true; $('brief').textContent = mode === 'manual' ? 'Reperti caricati manualmente.' : 'Immagine originale caricata nel laboratorio.'; }
  say(''); render();
  try {
    if (file.size > 64 * 1024 * 1024) throw Error('File PNG troppo grande: massimo 64 MiB');
    const buffer = await file.arrayBuffer(); if (token !== generation[slot]) return;
    const item = {...PngCodec.decode(buffer), name: file.name};
    if (slot === 'original') original = item; else if (slot === 'suspect') suspect = item; else mask = item;
    state(stateId, 'Caricato: ' + describe(item));
    if (slot === 'original') state(id === 'coverfile' ? 'original' : 'cover', 'Immagine originale condivisa: ' + describe(item));
    if (slot !== 'mask') { $('view').value = suspect ? 'suspect' : 'original'; autoFit = true; }
    render();
  } catch (error) { if (token !== generation[slot]) return; state(stateId, `Errore: ${file.name} · ${error.message}`); say(error.message); render(); }
}
for (const [id, slot] of [['original', 'original'], ['suspect', 'suspect'], ['coverfile', 'original'], ['maskfile', 'mask']]) {
  $(id).onchange = e => { const file = e.target.files[0]; e.target.value = ''; if (file) { if (id === 'coverfile' && mode === 'mission') setMode('manual'); loadFile(id, slot, file); } };
  $(id).addEventListener('cancel', () => say('Selezione annullata; i reperti correnti restano invariati.'));
}

const exampleNames=['Paesaggio marino','Tramonto','Mosaico geometrico','Farfalla','Bolle di sapone','Figure geometriche'];
const exampleFiles=['paesaggio-marino','tramonto','mosaico','farfalla','bolle-di-sapone','figure-geometriche'];
let exampleRequest=0;
$('coverfile').addEventListener('change',()=>{exampleRequest++;});
$('clearcover').addEventListener('click',()=>{exampleRequest++;});
for(let k=0;k<exampleNames.length;k++){
 const filename=exampleFiles[k]+'.png',url='images/examples/'+(k<3?'rgb':'rgba')+'/'+filename;
 const tile=document.createElement('div');tile.style.cssText='display:inline-flex;flex-direction:column;align-items:center;margin:4px;vertical-align:top';
 const button=document.createElement('button');button.type='button';button.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px';
 const img=document.createElement('img');img.src=url;img.alt='';img.width=120;img.height=75;img.style.background='repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0 0/16px 16px';
 button.append(img,document.createTextNode(exampleNames[k]+' · '+(k<3?'RGB':'RGBA')));
 button.onclick=async()=>{const token=++exampleRequest;try{const response=await fetch(url);if(!response.ok)throw Error('HTTP '+response.status);const blob=await response.blob();if(token!==exampleRequest)return;if(mode==='mission')setMode('manual');await loadFile('coverfile','original',new File([blob],filename,{type:'image/png'}));}catch(e){if(token===exampleRequest)state('cover','Errore nel caricamento dell’immagine di esempio: '+e.message);}};
 const link=document.createElement('a');link.href=url;link.download=filename;link.textContent='Scarica PNG';tile.append(button,link);$('coverexamples').append(tile);
}

function clearSlot(slot) {
  if (slot === 'original' || slot === 'suspect') generatedPair = null;
  invalidate(slot);
  if (slot === 'original') { generatedPair = null; original = null; state('original', 'Nessun file selezionato.'); state('cover', 'Nessuna immagine originale caricata.'); }
  else if (slot === 'suspect') { suspect = null; state('suspect', 'Nessun file selezionato.'); } else { mask = null; state('mask', 'Nessun file selezionato.'); }
  if (slot !== 'mask') { reset(); autoFit = true; } say(''); render();
}
$('clearoriginal').onclick = $('clearcover').onclick = () => clearSlot('original'); $('clearsuspect').onclick = () => clearSlot('suspect'); $('clearmask').onclick = () => clearSlot('mask');
for (const id of ['bit', 'extractbit', 'encbit', 'maskbit']) for (let i = 0; i < 8; i++) $(id).add(new Option(i === 0 ? '0 (LSB)' : i === 7 ? '7 (MSB)' : String(i), i));
function permutations(chars, prefix = '') { const result = prefix ? [prefix] : []; for (const c of chars) result.push(...permutations(chars.replace(c, ''), prefix + c)); return result; }
function updateSelect(id, choices, fallback, label) {
  const el = $(id), previous = el.value;
  if (Array.from(el.options, o => o.value).join('|') !== choices.join('|')) {
    el.replaceChildren(...choices.map(v => new Option(v, v))); el.value = choices.includes(previous) ? previous : fallback;
    if (previous && !choices.includes(previous)) say(`${label}: selezione ${previous} non disponibile; ripristinato ${el.value}. Il canale A richiede RGBA.`);
  }
}
function offset(p,item,scan){const x=$(p+'x'),y=$(p+'y');if(!item)throw Error('Nessuna immagine');if(x.value===''||y.value==='')throw Error('Inserisci entrambe le coordinate');const a=Number(x.value),b=Number(y.value);C.startIndex(item.width,item.height,scan,a,b);return [a,b];}
function offsetCapacity(p,item,scan,order){const x=$(p+'x'),y=$(p+'y');x.max=item?item.width-1:0;y.max=item?item.height-1:0;$(p+'error').textContent='';if(!item)return 0;try{return (item.width*item.height-C.startIndex(item.width,item.height,scan,...offset(p,item,scan)))*order.length;}catch(e){$(p+'error').textContent=e.message;return 0;}}
function setOffset(p,x,y){$(p+'x').value=x;$(p+'y').value=y;updateControls();mark();}
function updateControls() {
  const paired = comparable();
  for (const opt of $('view').options) opt.disabled = opt.value === 'original' ? !original : opt.value === 'suspect' ? !suspect : opt.value === 'diff' || opt.value === 'xor' ? !paired : !original && !suspect;
  if ($('view').selectedOptions[0].disabled) $('view').value = suspect ? 'suspect' : original ? 'original' : 'suspect';
  const planeImage = suspect || original, alphaView = !!(planeImage?.hasAlpha && ($('view').value !== 'xor' || original?.hasAlpha));
  updateSelect('channel', [...(alphaView ? 'RGBA' : 'RGB')], 'R', 'Visualizzazione'); updateSelect('maskchannel', [...(original?.hasAlpha ? 'RGBA' : 'RGB')], 'R', 'Immagine segreta');
  for (const [id, item, label] of [['order', suspect, 'Estrazione'], ['encorder', original, 'Encoder']]) {
    const all = permutations(item?.hasAlpha ? 'RGBA' : 'RGB'), preferred = ['RGB', 'R', 'G', 'B', 'BGR', 'RG', 'RB', 'GB', 'A', 'RGBA'].filter(v => all.includes(v));
    updateSelect(id, [...preferred, ...all.filter(v => !preferred.includes(v))], 'RGB', label);
  }
  $('extract').disabled = !suspect; $('encode').disabled = !original; $('hidemask').disabled = !original || !mask; $('analysecreated').disabled = !(generatedPair && generatedPair.original === original && generatedPair.result === suspect);
  const encBits = offsetCapacity('encoff',original,$('encscan').value,$('encorder').value), bytes = new TextEncoder().encode($('message').value).length;
  $('capacity').textContent = `Capacità: ${encBits} bit · ${Math.floor(encBits / 8)} byte UTF-8; messaggio: ${bytes * 8} bit · ${bytes} byte${bytes * 8 > encBits ? ' (oltre la capacità)' : ''}.${original && !original.hasAlpha ? ' RGB non dispone di A: non viene convertito in RGBA.' : ''}`;
  const n = offsetCapacity('extoff',suspect,$('scan').value,$('order').value); $('extractcapacity').textContent = `Capacità: ${n} bit · ${Math.floor(n / 8)} byte completi. Raccolta automatica: massimo 65536 bit.`;
  $('encode').disabled=!original||!encBits||bytes*8>encBits; $('extract').disabled=!suspect||!n; $('extoffpick').disabled=!suspect; $('encoffpick').disabled=!original; markOffset();
}
function fitZoom() {
  const items = [original, current()].filter(Boolean); if (!items.length || panels[0].hidden) return;
  const widths = [...document.querySelectorAll('.viewport')].map(e => e.clientWidth).filter(n => n > 0); if (!widths.length) return;
  zoom = Math.min(24, Math.min(...widths) / Math.max(...items.map(i => i.width)), 400 / Math.max(...items.map(i => i.height))); $('zoom').value = String(Math.log(zoom));
}
function drawCanvas(element, item) {
  const wrap = element.parentElement; wrap.hidden = !item;
  if (!item) { element.width = 1; element.height = 1; element.getContext('2d').clearRect(0, 0, 1, 1); return; }
  element.width = item.width; element.height = item.height; element.style.width = item.width * zoom + 'px'; element.style.height = item.height * zoom + 'px';
  element.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(item.data), item.width, item.height), 0, 0);
  wrap.classList.toggle('gridded', $('grid').checked && zoom >= 5); wrap.style.setProperty('--zoom', zoom + 'px');
}
function render() {
  updateControls(); if (autoFit) fitZoom(); $('zoomvalue').textContent = (zoom * 100).toLocaleString('it-IT', {maximumFractionDigits: zoom < 0.01 ? 4 : 1}) + '%';
  const view = $('view').value, base = current(), paired = comparable();
  document.querySelectorAll('.plane-control').forEach(e => e.hidden = !['plane', 'xor'].includes(view)); $('viewtitle').textContent = $('view').selectedOptions[0].textContent; $('planeinfo').textContent = ''; planeBuffer = null;
  let output = base;
  if (base && view === 'diff' && paired) {
    const data = new Uint8ClampedArray(base.data.length), names = original.hasAlpha && suspect.hasAlpha ? 'RGBA' : 'RGB'; let transparentChanges = 0;
    for (let i = 0; i < data.length; i += 4) {
      const changed = [...names].some(c => original.data[i + 'RGBA'.indexOf(c)] !== suspect.data[i + 'RGBA'.indexOf(c)]);
      if (changed && ((original.hasAlpha && original.data[i + 3] === 0) || (suspect.hasAlpha && suspect.data[i + 3] === 0))) transparentChanges++;
      data.set(changed ? [255, 80, 80, 255] : [20, 25, 30, 255], i);
    }
    output = artifact(data, base.width, base.height, true, 'Differenze'); $('planeinfo').textContent = `${transparentChanges} pixel alterati coinvolgono almeno un pixel con A=0: le differenze possono essere invisibili nell’anteprima.`;
  }
  if (base && (view === 'plane' || view === 'xor')) {
    const source = suspect || original, ref = view === 'xor' ? original : null;
    const data = C.plane(source.data, $('channel').value, Number($('bit').value), ref?.data ?? null, source.hasAlpha, ref ? ref.hasAlpha : source.hasAlpha);
    planeBuffer = artifact(data, source.width, source.height, true, 'Piano'); output = planeBuffer; let n = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 255) n++;
    $('planeinfo').textContent = view === 'xor' ? `Bianco = bit modificato; nero = invariato. ${n} bit modificati.` : `Bianco = 1; nero = 0. ${n} bit a 1.`;
  }
  $('saveplane').hidden = !planeBuffer; drawCanvas(reference, original); drawCanvas(canvas, output);
  const preview = $('coverpreview'); preview.hidden = !original; $('coverinfo').textContent = original ? describe(original) : 'Nessuna immagine originale caricata.';
  if (original) { preview.width = original.width; preview.height = original.height; preview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(original.data), original.width, original.height), 0, 0); }
  else { preview.width = 1; preview.height = 1; preview.getContext('2d').clearRect(0, 0, 1, 1); }
  const result = generatedPair && generatedPair.original === original && generatedPair.result === suspect ? suspect : null;
  const resultPreview = $('resultpreview'); resultPreview.hidden = !result;
  $('resultinfo').textContent = result ? describe(result) : 'Nessuna immagine steganografata.';
  if (result) { resultPreview.width = result.width; resultPreview.height = result.height; resultPreview.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.data), result.width, result.height), 0, 0); }
  else { resultPreview.width = 1; resultPreview.height = 1; }
  if (paired) { const d = C.diff(original.data, suspect.data, original.hasAlpha, suspect.hasAlpha); $('stats').textContent = `${d.pixels} pixel alterati su ${original.width * original.height} · ${d.values} valori alterati · variazione massima ${d.max} · ${Object.entries(d.channels).map(([c, n]) => `${c}: ${n}`).join(' · ')}${d.formatsDiffer ? ' · Formati diversi: confronto solo RGB; XOR A non disponibile.' : ''}`; }
  else $('stats').textContent = original && suspect ? 'Dimensioni diverse: confronto e XOR non disponibili.' : base ? `${base.width} × ${base.height} pixel · ${base.hasAlpha ? 32 : 24} piani` : 'Nessun reperto disponibile.';
  if (base) { selected = C.move(selected[0], selected[1], 0, 0, base.width, base.height); inspect(...selected); } else { $('pixel').replaceChildren(); $('x').value = 0; $('y').value = 0; mark(); }
}
function markOffset(){for(const c of [canvas,reference,$('coverpreview')]){const p=c===$('coverpreview')?'encoff':'extoff',item=p==='encoff'?original:suspect;let m=c===$('coverpreview')?$('coveroffset'):c.parentElement.querySelector('.offsetmarker');if(!m){m=document.createElement('span');m.className='offsetmarker';c.parentElement.append(m);}m.hidden=true;if(!item||c.hidden||c.parentElement.hidden||c.width!==item.width||c.height!==item.height)continue;try{const [x,y]=offset(p,item,p==='encoff'?$('encscan').value:$('scan').value),sx=c.clientWidth/c.width,sy=c.clientHeight/c.height;if(!sx||!sy)continue;m.style.left=(c.offsetLeft+x*sx)+'px';m.style.top=(c.offsetTop+y*sy)+'px';m.style.width=Math.max(5,sx)+'px';m.style.height=Math.max(5,sy)+'px';m.hidden=false;}catch{}}}
function mark() {
  for (const c of [canvas, reference]) { const marker = c.parentElement.querySelector('.marker'); marker.hidden = c.parentElement.hidden || selected[0] >= c.width || selected[1] >= c.height; marker.style.left = selected[0] * zoom + 'px'; marker.style.top = selected[1] * zoom + 'px'; marker.style.width = zoom + 'px'; marker.style.height = zoom + 'px'; } markOffset();
}
function inspect(x, y) {
  const base = current(); if (!base || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= base.width || y >= base.height) { $('pixel').textContent = 'Coordinate fuori immagine'; return; }
  selected = [x, y]; mark(); $('x').value = x; $('y').value = y; const same = comparable(), showOriginal = original && (same || base === original), showSuspect = suspect && (same || base === suspect);
  const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Canale</th><th>Originale</th><th>Sospetta (clicca un bit)<br><small>Posizione: 7 6 5 4 3 2 1 0<br>Peso: 128 64 32 16 8 4 2 1</small></th></tr></thead>'; const body = table.createTBody();
  for (let c = 0; c < (base.hasAlpha || (same && (original.hasAlpha || suspect.hasAlpha)) ? 4 : 3); c++) {
    const row = body.insertRow(); row.insertCell().textContent = 'RGBA'[c];
    const a = showOriginal && (c !== 3 || original.hasAlpha) ? original.data[(y * original.width + x) * 4 + c] : null, b = showSuspect && (c !== 3 || suspect.hasAlpha) ? suspect.data[(y * suspect.width + x) * 4 + c] : null;
    row.insertCell().textContent = a === null ? '—' : `${a} / ${a.toString(2).padStart(8, '0')}`; const cell = row.insertCell(); if (b === null) { cell.textContent = '—'; continue; } cell.append(b + ' / ');
    for (let k = 7; k >= 0; k--) { const button = document.createElement('button'); button.textContent = (b >> k) & 1; button.title = `Bit ${k} · peso ${2 ** k}`; button.setAttribute('aria-label', `Canale ${'RGBA'[c]} bit ${k} valore ${button.textContent}`); if (a !== null && ((a ^ b) >> k & 1)) button.className = 'changed'; button.onclick = () => { if (bits.length < 65536) { bits += button.textContent; bitSources.push({x,y,channel:'RGBA'[c],bit:k}); showBits(); } else say('Limite: 65536 bit raccolti.'); }; cell.append(button); }
  }
  $('pixel').replaceChildren(table);
}
for (const id of ['view', 'channel', 'bit', 'grid', 'encorder', 'order', 'message']) $(id).oninput = render;
for(const p of ['encoff','extoff']){for(const axis of ['x','y'])$(p+axis).oninput=()=>{updateControls();mark();};$(p+'reset').onclick=()=>setOffset(p,0,0);$(p+'pick').onclick=()=>setOffset(p,...selected);}
for(const id of ['scan','encscan'])$(id).oninput=()=>{updateControls();mark();};
$('coverpreview').onclick=e=>{if(!original)return;const r=e.currentTarget.getBoundingClientRect();if(!r.width||!r.height)return;selected=[Math.min(original.width-1,Math.max(0,Math.floor((e.clientX-r.left)*original.width/r.width))),Math.min(original.height-1,Math.max(0,Math.floor((e.clientY-r.top)*original.height/r.height)))];setOffset('encoff',...selected);};
$('zoom').oninput = () => { autoFit = false; zoom = Math.exp(Number($('zoom').value)); render(); }; $('fit').onclick = () => { autoFit = true; render(); }; window.addEventListener('resize', () => { if (autoFit) render(); });
for (const c of [canvas, reference]) {
  c.onclick = e => { c.focus({preventScroll: true}); if (c === reference && original && suspect && !comparable() && $('view').value !== 'original') { $('view').value = 'original'; render(); } const r = c.getBoundingClientRect(); if (r.width && r.height) inspect(Math.floor((e.clientX - r.left) * c.width / r.width), Math.floor((e.clientY - r.top) * c.height / r.height)); };
  c.onkeydown = e => { const d = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key], base = current(); if (!d || !base) return; e.preventDefault(); inspect(...C.move(...selected, ...d, base.width, base.height));
    for (const v of [canvas, reference]) { if (v.parentElement.hidden) continue; const vp = v.parentElement.parentElement, x = selected[0] * zoom, y = selected[1] * zoom; if (x < vp.scrollLeft) vp.scrollLeft = x; else if (x + zoom > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = x + zoom - vp.clientWidth; if (y < vp.scrollTop) vp.scrollTop = y; else if (y + zoom > vp.scrollTop + vp.clientHeight) vp.scrollTop = y + zoom - vp.clientHeight; }
  };
}
$('inspect').onclick = () => inspect(Number($('x').value), Number($('y').value)); $('next').onclick = () => { const b = current(); if (b) { const n = selected[1] * b.width + selected[0] + 1; if (n < b.width * b.height) inspect(n % b.width, Math.floor(n / b.width)); } };
$('saveplane').onclick = () => { try { if (planeBuffer) downloadPng(planeBuffer, 'piano.png'); } catch (e) { say(e.message); } };
$('undo').onclick = () => { bits = bits.slice(0, -1); bitSources.pop(); showBits(); }; $('clear').onclick = () => { bits = ''; bitSources = []; showBits(); };
$('extract').onclick = () => { try { if (!suspect) throw Error('Carica una sospetta'); const n = Number($('count').value); if (!Number.isInteger(n) || n < 1 || n > 65536) throw Error('Limite: 1–65536 bit'); bits = C.extract(suspect.data, suspect.width, suspect.height, $('order').value, $('scan').value, Number($('extractbit').value), n, suspect.hasAlpha,...offset('extoff',suspect,$('scan').value)); bitSources = []; for (const p of C.positions(suspect.width, suspect.height, $('order').value, $('scan').value, suspect.hasAlpha,...offset('extoff',suspect,$('scan').value))) { if (bitSources.length === n) break; const pixel = Math.floor(p / 4); bitSources.push({x:pixel % suspect.width,y:Math.floor(pixel / suspect.width),channel:'RGBA'[p % 4],bit:Number($('extractbit').value)}); } showBits(); } catch (e) { say(e.message); } };
$('decode').onclick = () => { try { $('decoded').textContent = C.decode(bits); } catch (e) { if (bits.length % 8) { $('decoded').textContent = 'Servono gruppi completi di 8 bit. Bit residui: ' + (bits.length % 8) + '.'; return; } const bytes = Uint8Array.from(bits.match(/.{8}/g) || [], s => parseInt(s, 2)); const preview = new TextDecoder('utf-8').decode(bytes); $('decoded').textContent = 'Sequenza UTF-8 non valida. Verifica numero di bit, ordine dei canali, posizione del bit, offset e scansione.\nAnteprima indicativa (� = sequenza non valida): ' + preview; } };
function created(data, name) {
  const result = artifact(data, original.width, original.height, original.hasAlpha, name), png = PngCodec.encode(result); invalidate('suspect'); suspect = result; generatedPair = {original, result}; setMode('manual', true); $('brief').textContent = 'Reperto creato nel laboratorio.'; $('view').value = 'suspect'; state('suspect', 'Generato: ' + describe(result)); autoFit = true; render(); download(new Blob([png], {type: 'image/png'}), name); say('Immagine steganografata generata nel formato dell’originale.');
}
$('encode').onclick = () => { try { if (!original) throw Error('Carica un’immagine originale'); if (!$('message').value) throw Error('Inserisci un messaggio'); created(C.encode(original.data, original.width, original.height, $('encorder').value, $('encscan').value, Number($('encbit').value), $('message').value, original.hasAlpha,...offset('encoff',original,$('encscan').value)), 'reperto.png'); } catch (e) { say(e.message); } };
$('hidemask').onclick = () => { try { if (!original || !mask) throw Error('Carica l’immagine originale e l’immagine segreta'); if (mask.width !== original.width || mask.height !== original.height) throw Error('La PNG segreta deve avere le stesse dimensioni dell’immagine originale'); created(C.hideMask(original.data, mask.data, $('maskchannel').value, Number($('maskbit').value), original.hasAlpha), 'reperto-immagine.png'); } catch (e) { say(e.message); } };
$('report').onclick = () => download(new Blob(['# Relazione SteganoLab\n\n' + $('brief').textContent + '\n\n' + $('notes').value + '\n\nBit: ' + bits + '\n\nDecodifica: ' + $('decoded').textContent], {type: 'text/markdown'}), 'relazione.md');
const steps = ['Confronta i reperti e formula una prima ipotesi.', 'Attiva Differenze e osserva dove si concentrano le alterazioni.', 'Ispeziona almeno cinque pixel: quali bit cambiano?', 'Raccogli i bit della sospetta, anche quelli invariati.', 'Decodifica i byte e verifica la tua ipotesi.', 'Scrivi ed esporta la relazione.'];
function guide() { const visual = ['Confronta i reperti e formula una ipotesi.', 'Esplora i piani dei canali.', 'Cerca una figura riconoscibile.', 'Annota canale e posizione del bit.', 'Scarica il piano e descrivi la figura.', 'Esporta la relazione.']; $('guide').textContent = `${step + 1} / ${steps.length} — ${([3, 4].includes(Number($('mission').value)) ? visual : steps)[step]}`; $('prevstep').disabled = step === 0; $('nextstep').disabled = step === steps.length - 1; }
$('prevstep').onclick = () => { step = Math.max(0, step - 1); guide(); }; $('nextstep').onclick = () => { step = Math.min(steps.length - 1, step + 1); guide(); };
$('load').onclick = () => {
  invalidate('original', 'suspect'); const m = Number($('mission').value), w = m === 3 || m === 4 ? 64 : 32, h = m === 3 || m === 4 ? 48 : 20, d = new Uint8ClampedArray(w * h * 4), alpha = m === 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const rock = y > 8 + Math.sin(x / 5) * 4 && x > 10, pixel = rock ? [174 + x % 9, 155 + y % 11, 119 + x % 7, 255] : [60 + x % 15, 135 + y * 3, 185 + x % 17, 255]; if (alpha) pixel[3] = x < 11 ? 255 : x < 22 ? 128 : 0; d.set(pixel, (y * w + x) * 4); }
  original = artifact(d, w, h, alpha, 'Originale sintetico');
  const cases = [['CIAO', 'RGB', 'row', 0, 'Il segreto della Sella del Diavolo: ricostruisci 4 caratteri.'], ['FARO', 'G', 'row', 0, 'Il segnale del faro: 4 caratteri in un solo canale.'], ['NORD', 'B', 'col', 0, 'Le coordinate perdute: 4 caratteri; prova una scansione diversa.']]; let result, brief;
  if (m === 3 || m === 4) {
    const data = new Uint8ClampedArray(d.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const on = m === 3 ? ((x - 23) ** 2 + (y - 17) ** 2 < 100 || (x - 41) ** 2 + (y - 17) ** 2 < 100 || (y >= 17 && y < 42 && Math.abs(x - 32) < (42 - y) * 0.85)) : (x >= 5 && x <= 53 && Math.abs(y - (39 - x * 0.55 + 4 * Math.sin(x / 5))) < 1.5 && x % 8 < 5) || (x >= 49 && x <= 61 && y >= 4 && y <= 16 && (Math.abs(x - 55 - (y - 10)) < 1.5 || Math.abs(x - 55 + (y - 10)) < 1.5)); data.set([on ? 255 : 0, on ? 255 : 0, on ? 255 : 0, 255], (y * w + x) * 4); }
    result = C.hideMask(d, data, m === 3 ? 'G' : 'B', m === 3 ? 0 : 1); brief = m === 3 ? 'Il simbolo nascosto: esplora i 24 piani e identifica la figura.' : 'La mappa del tesoro: trova il percorso e il segno di destinazione nei piani di bit.';
  } else { const entry = m === 5 ? ['TRAC', 'RG', 'row', 2, 'Le tracce digitali: individua canali e bit alterati con XOR, poi ricostruisci 4 caratteri.'] : m === 6 ? ['LUCE', 'A', 'row', 0, 'Il segreto della trasparenza: individua le alterazioni e ricostruisci 4 caratteri UTF-8 (32 bit).'] : cases[m]; result = C.encode(d, w, h, entry[1], entry[2], entry[3], entry[0], alpha); brief = entry[4]; }
  suspect = artifact(result, w, h, alpha, 'Sospetta sintetica'); for(const p of ['encoff','extoff']){$(p+'x').value=0;$(p+'y').value=0;} reset(); $('brief').textContent = brief + ' Reperto sintetico.'; state('original', describe(original)); state('suspect', describe(suspect)); state('cover', 'Immagine originale condivisa: ' + describe(original)); $('view').value = 'suspect'; $('count').value = 32; autoFit = true; say('Missione avviata'); render();
};
function switchTab(index) { tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; panels[i].hidden = i !== index; }); render(); }
tabs.forEach((tab, i) => { tab.onclick = () => switchTab(i); tab.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const next = 1 - i; switchTab(next); tabs[next].focus(); } }; });
$('analysecreated').onclick = () => { if (!generatedPair || generatedPair.original !== original || generatedPair.result !== suspect) { say('Genera prima un reperto'); return; } setMode('manual', true); switchTab(0); $('view').value = 'suspect'; render(); tabs[0].focus(); };
const controls = 'NUL SOH STX ETX EOT ENQ ACK BEL BS HT LF VT FF CR SO SI DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM SUB ESC FS GS RS US'.split(' '), ascii = $('ascii');
const utfEncoder=new TextEncoder();
function utfValues(ch){const cp=ch.codePointAt(0),bytes=Array.from(utfEncoder.encode(ch));return [cp<32?controls[cp]:cp===32?'SP (spazio)':cp===127?'DEL':ch,'U+'+cp.toString(16).toUpperCase().padStart(4,'0'),bytes.join(' '),bytes.map(b=>b.toString(2).padStart(8,'0')).join(' '),bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')];}
function utfRow(body,values){const row=body.insertRow();for(const v of values)row.insertCell().textContent=v;}
function filterAscii(){const q=$('asciisearch').value.trim().toLowerCase();ascii.replaceChildren();const chars=[...Array.from({length:128},(_,i)=>String.fromCodePoint(i)),...new Set(Array.from('àèéìòùÀÈÉÌÒÙäöüñçß€£©®°–—…αβΩ中😀'))];for(const ch of chars){const values=utfValues(ch);if(!q||values.some(v=>v.toLowerCase().includes(q)))utfRow(ascii,values);}}
function renderUtf(){const value=$('utftext').value,chars=Array.from(value),n=utfEncoder.encode(value).length,body=$('utfrows');body.replaceChildren();for(const ch of chars.slice(0,512))utfRow(body,utfValues(ch));$('utfsummary').textContent=chars.length+' punti di codice · '+n+' byte · '+(n*8)+' bit'+(chars.length>512?' (primi 512 mostrati)':'');}
$('utftext').oninput=renderUtf;$('asciisearch').oninput=filterAscii;for(const id of ['openascii','asciinear'])$(id).onclick=()=>{$('asciisearch').value='';filterAscii();renderUtf();$('asciidialog').showModal();$('utftext').focus();};$('closeascii').onclick=()=>$('asciidialog').close();
let rgba = [128, 128, 128, 255], rgbaRef = rgba.slice(); const rgbRows = [];
for (let c = 0; c < 4; c++) {
  const row = document.createElement('div'); row.className = 'rgbrow'; const label = document.createElement('label'); label.textContent = ['Rosso (R)', 'Verde (G)', 'Blu (B)', 'Alfa (A)'][c]; const range = document.createElement('input'); range.type = 'range'; range.min = 0; range.max = 255; label.append(range); const num = document.createElement('input'); num.type = 'number'; num.min = 0; num.max = 255; num.setAttribute('aria-label', label.textContent + ' valore'); const box = document.createElement('div'); box.className = 'rgbbits'; const buttons = [];
  for (let k = 7; k >= 0; k--) { const b = document.createElement('button'); b.title = `Bit ${k} · peso ${2 ** k}`; b.onclick = () => { rgba[c] ^= 1 << k; drawRGB(); }; buttons.push(b); const cell = document.createElement('span'); cell.className = 'rgbbitcell'; const weight = document.createElement('span'); weight.className = 'rgbweight'; weight.textContent = '2' + ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷'][k]; weight.title = 'Peso ' + 2 ** k; cell.append(weight, b); box.append(cell); }
  range.oninput = () => { rgba[c] = Number(range.value); drawRGB(); }; num.onchange = () => { rgba[c] = Math.max(0, Math.min(255, Math.round(Number(num.value) || 0))); drawRGB(); }; const sum = document.createElement('div'); sum.className = 'rgbsum'; row.append(label, num, box, sum); $('rgbcontrols').append(row); rgbRows.push({range, num, buttons, sum});
}
function hexRGBA(v) { return '#' + v.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase(); }
function drawRGB() {
  rgbRows.forEach(({range, num, buttons, sum}, c) => { range.value = rgba[c]; num.value = rgba[c]; buttons.forEach((b, j) => { b.textContent = (rgba[c] >> (7 - j)) & 1; b.parentElement.classList.toggle('activeweight', b.textContent === '1'); b.setAttribute('aria-label', `Canale ${'RGBA'[c]}, bit ${7 - j}, valore ${b.textContent}`); b.classList.toggle('changed', !!((rgba[c] ^ rgbaRef[c]) >> (7 - j) & 1)); }); sum.textContent = (Array.from({length: 8}, (_, j) => 7 - j).filter(k => (rgba[c] >> k) & 1).map(k => 2 ** k).join(' + ') || '0') + ' = ' + rgba[c]; });
  for (const [id, v] of [['rgbref', rgbaRef], ['rgbcurrent', rgba]]) { $(id).style.backgroundColor = hexRGBA(v); $(id + 'text').textContent = `RGBA (${v.join(', ')}) · ${hexRGBA(v)} · opacità ${(v[3] / 255 * 100).toLocaleString('it-IT', {maximumFractionDigits: 1})}%`; } $('rgbdelta').textContent = 'Variazione R, G, B, A: ' + rgba.map((v, c) => { const d = v - rgbaRef[c]; return d > 0 ? '+' + d : String(d); }).join(', ');
}
$('rgbpin').onclick = () => { rgbaRef = rgba.slice(); drawRGB(); }; $('rgbreset').onclick = () => { rgba = rgbaRef.slice(); drawRGB(); }; $('openrgb').onclick = () => { $('rgborigin').textContent = 'Simulazione libera.'; drawRGB(); $('rgbdialog').showModal(); }; $('closergb').onclick = () => $('rgbdialog').close();
$('pixelrgb').onclick = () => { const base = current(); if (!base) return; const [x, y] = selected, i = (y * base.width + x) * 4; rgba = Array.from(base.data.slice(i, i + 4)); rgbaRef = comparable() ? Array.from(original.data.slice(i, i + 4)) : rgba.slice(); $('rgborigin').textContent = base.hasAlpha ? 'Pixel RGBA: valori grezzi, anche se invisibili.' : 'Pixel RGB: alfa assente, opacità implicita 255; A è simulabile.'; drawRGB(); $('rgbdialog').showModal(); };
for (const [name, value] of [['Nero', [0, 0, 0]], ['Bianco', [255, 255, 255]], ['Rosso', [255, 0, 0]], ['Verde', [0, 255, 0]], ['Blu', [0, 0, 255]], ['Giallo', [255, 255, 0]], ['Ciano', [0, 255, 255]], ['Magenta', [255, 0, 255]], ['Grigio', [128, 128, 128]], ['Arancione', [255, 165, 0]], ['Viola', [128, 0, 128]], ['Marrone', [165, 42, 42]]]) { const b = document.createElement('button'), chip = document.createElement('span'); chip.className = 'palettechip'; chip.style.backgroundColor = hexRGBA([...value, 255]); b.append(chip, document.createTextNode(name + ' ' + value.join(', '))); b.onclick = () => { rgba = [...value, 255]; drawRGB(); }; $('rgbpalette').append(b); }
drawRGB(); $('load').click();
