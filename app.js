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
const current = () => !comparable() && $('analysisSource').value === 'original' && original ? original : suspect || original;
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
function byteCharacters(values){const out=[];for(let i=0;i<values.length;){const b=values[i],n=b<128?1:b>=194&&b<=223?2:b>=224&&b<=239?3:b>=240&&b<=244?4:0;if(!n){out[i++]='non valido';continue;}const seq=values.slice(i,i+n);if(!seq.slice(1).every((v,j)=>v>=128&&v<=191&&!(j===0&&((b===224&&v<160)||(b===237&&v>159)||(b===240&&v<144)||(b===244&&v>143))))){out[i++]='non valido';continue;}if(seq.length<n){while(i<values.length)out[i++]='in attesa';break;}let cp=b&(n===1?127:n===2?31:n===3?15:7);for(const v of seq.slice(1))cp=(cp<<6)|(v&63);const c=String.fromCodePoint(cp);for(let j=0;j<n-1;j++)out[i+j]='→';out[i+n-1]=cp===32?'SP':cp===10?'LF':cp===13?'CR':cp===9?'TAB':cp<32||cp>=127&&cp<=159?'U+'+cp.toString(16).toUpperCase().padStart(4,'0'):c;i+=n;}return out;}
function showBits() {
  const chars=byteCharacters((bits.slice(0,512).match(/.{8}/g)||[]).map(b=>parseInt(b,2)));
  const el = $('bits'); el.replaceChildren(); $('bitsummary').textContent = `${bits.length} bit raccolti · ${Math.floor(bits.length / 8)} byte completi${bits.length % 8 ? ' · ' + (bits.length % 8) + ' bit residui' : ''}`;
  let byteIndex = 0;
  for (const group of bits.slice(0, 512).match(/.{1,8}/g) || []) {
    const row = document.createElement('div'); row.className = 'byte';
    const sources = bitSources.slice(byteIndex * 8, byteIndex * 8 + group.length);
    const coords = [...new Set(sources.map(p => `(${p.x}, ${p.y})`))];
    const label = document.createElement('div'); label.className = 'byte-source'; label.textContent = `${++byteIndex}. ${coords.join(' · ')}`; label.title = sources.map((p,i) => `Bit ${7-i}: (${p.x}, ${p.y}) · ${p.channel} · posizione ${p.bit}`).join('\n'); el.append(label);
    for (let i = 0; i < 8; i++) { const cell = document.createElement('span'); cell.textContent = group[i] ?? '·'; row.append(cell); }
    const val = document.createElement('small'); val.textContent = group.length === 8 ? ' = ' + parseInt(group, 2) : ''; row.append(val); if(group.length===8){const char=document.createElement('small');char.className='byte-character';char.style.fontSize='inherit';char.style.fontWeight='bold';char.textContent=' · '+chars[byteIndex-1];char.title='Anteprima UTF-8: → indica un byte di una sequenza multibyte';row.append(char);} el.append(row);
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
for (const [id, slot] of [['original', 'original'], ['suspect', 'suspect'], ['coverfile', 'original']]) {
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
$('clearoriginal').onclick = $('clearcover').onclick = () => clearSlot('original'); $('clearsuspect').onclick = () => clearSlot('suspect');
for (const id of ['bit', 'extractbit', 'encbit']) for (let i = 0; i < 8; i++) $(id).add(new Option(i === 0 ? '0 (LSB)' : i === 7 ? '7 (MSB)' : String(i), i));
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
  refreshMaskOwner();
  const ready=!!original && mode==='manual'; $('encoderfields').disabled=!ready; $('encoderlock').hidden=ready; $('encoderpanel').classList.toggle('encoder-locked',!ready);
  const paired = comparable();
  const any=!!(original||suspect), source=$('analysisSource');
  source.options[0].disabled=!suspect;source.options[1].disabled=!original;
  if(source.selectedOptions[0].disabled)source.value=suspect?'suspect':'original';
  $('singleSource').hidden=paired||!original||!suspect;
  if($('view').value==='original'){$('view').value='suspect';if(!paired&&original)source.value='original';}
  if(!paired&&['diff','xor'].includes($('view').value))$('view').value='suspect';
  $('view').disabled=!any; for(const opt of $('view').options)opt.disabled=!paired&&['diff','xor'].includes(opt.value);
  $('referencepanel').hidden=!paired;
  $('analysiscomparison').classList.toggle('single',!paired);
  $('alterationdetails').hidden=!paired;
  const alphaView=paired?original.hasAlpha&&suspect.hasAlpha:!!current()?.hasAlpha;
  updateSelect('channel',[...(alphaView?'RGBA':'RGB')],'R','Visualizzazione');
  for (const [id, item, label] of [['order', suspect, 'Estrazione'], ['encorder', original, 'Encoder']]) {
    const all = permutations(item?.hasAlpha ? 'RGBA' : 'RGB'), preferred = ['RGB', 'R', 'G', 'B', 'BGR', 'RG', 'RB', 'GB', 'A', 'RGBA'].filter(v => all.includes(v));
    updateSelect(id, [...preferred, ...all.filter(v => !preferred.includes(v))], 'RGB', label);
  }
  $('extract').disabled = !suspect; $('encode').disabled = !original; $('analysecreated').disabled = !(generatedPair && generatedPair.original === original && generatedPair.result === suspect);
  $('downloadcreated').disabled = $('analysecreated').disabled;
  const encBits = offsetCapacity('encoff',original,$('encscan').value,$('encorder').value), bytes = new TextEncoder().encode($('message').value).length;
  const maxBytes=Math.floor(encBits/8), remaining=maxBytes-bytes;
  $('capacity').textContent = `Capacità: ${maxBytes.toLocaleString('it-IT')} byte · Utilizzati: ${bytes.toLocaleString('it-IT')} byte · ${remaining>=0?'Ancora disponibili: '+remaining.toLocaleString('it-IT'):'Capacità superata di '+(-remaining).toLocaleString('it-IT')} byte`;
  $('capacity').classList.toggle('overcapacity',remaining<0);
  const n = offsetCapacity('extoff',suspect,$('scan').value,$('order').value); $('extractcapacity').textContent = `Capacità: ${n} bit · ${Math.floor(n / 8)} byte completi. Raccolta automatica: massimo 65536 bit.`;
  refreshGeneration(); $('extract').disabled=!suspect||!n; $('extoffpick').disabled=!suspect; $('encoffpick').disabled=!original; markOffset();
}
function fitZoom() {
  const items = (comparable()?[original,suspect]:[current()]).filter(Boolean); if (!items.length || panels[0].hidden) return;
  const widths = [...document.querySelectorAll('#analysiscomparison > div:not([hidden]) .viewport')].map(e => e.clientWidth).filter(n => n > 0); if (!widths.length) return;
  zoom = Math.min(24, Math.min(...widths) / Math.max(...items.map(i => i.width)), Math.min(...[...document.querySelectorAll('.viewport')].map(e=>e.clientHeight).filter(n=>n>0)) / Math.max(...items.map(i => i.height))); $('zoom').value = String(Math.log(zoom));
}
function drawCanvas(element, item) {
  const wrap = element.parentElement; wrap.hidden = !item;
  if (!item) { element.width = 1; element.height = 1; element.getContext('2d').clearRect(0, 0, 1, 1); return; }
  element.width = item.width; element.height = item.height; element.style.width = item.width * zoom + 'px'; element.style.height = item.height * zoom + 'px';
  element.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(item.data), item.width, item.height), 0, 0);
  wrap.classList.toggle('gridded', $('grid').checked && zoom >= 5); wrap.style.setProperty('--zoom', zoom + 'px');
}
let alterationCache=null;
function countAlterations(a,b){const n=a.hasAlpha&&b.hasAlpha?4:3,counts=Array.from({length:n},()=>Array(8).fill(0));for(let i=0;i<a.data.length;i+=4)for(let c=0;c<n;c++){let x=a.data[i+c]^b.data[i+c];for(let k=0;x;k++,x>>>=1)counts[c][k]+=x&1;}return counts;}
function renderAlterations(){const el=$('alterationmatrix');if(!comparable()){el.replaceChildren();alterationCache=null;return;}if(alterationCache?.a===original&&alterationCache?.b===suspect){syncAlterationSelection();return;}const counts=countAlterations(original,suspect);alterationCache={a:original,b:suspect};const table=document.createElement('table'),head=table.createTHead().insertRow();for(const label of ['Canale','7','6','5','4','3','2','1','0']){const th=document.createElement('th');th.textContent=label;head.append(th);}const body=table.createTBody();counts.forEach((row,c)=>{const tr=body.insertRow();tr.insertCell().textContent='RGBA'[c];for(let k=7;k>=0;k--){const btn=document.createElement('button');btn.type='button';btn.dataset.plane='RGBA'[c]+k;btn.textContent=row[k].toLocaleString('it-IT');btn.classList.toggle('altered',row[k]>0);btn.title='Visualizza XOR '+ 'RGBA'[c]+k+' · '+row[k]+' bit alterati';btn.setAttribute('aria-label',btn.title);btn.onclick=()=>{$('view').value='xor';$('channel').value='RGBA'[c];$('bit').value=String(k);render();};tr.insertCell().append(btn);}});el.replaceChildren(table);syncAlterationSelection();}
function syncAlterationSelection(){const key=$('view').value==='xor'?$('channel').value+$('bit').value:'';let label='Seleziona una cella per visualizzare la mappa XOR.';for(const btn of $('alterationmatrix').querySelectorAll('button[data-plane]')){const active=btn.dataset.plane===key;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));if(active)label='Piano XOR selezionato: '+key+' — '+btn.textContent+' bit alterati';}const status=$('alterationselection');if(status&&status.textContent!==label)status.textContent=label;}
$('view').onchange=render;
$('analysisSource').onchange=render;
for(const c of [canvas,reference]){c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect();const x=Math.floor((e.clientX-r.left)*c.width/r.width),y=Math.floor((e.clientY-r.top)*c.height/r.height);$('analysiscoords').textContent=x>=0&&y>=0&&x<c.width&&y<c.height?'X: '+x+' · Y: '+y:'X: — · Y: —';});c.addEventListener('pointerleave',()=>{$('analysiscoords').textContent='X: — · Y: —';});}
function render() {
  updateControls(); if (autoFit) fitZoom(); $('zoomvalue').textContent = (zoom * 100).toLocaleString('it-IT', {maximumFractionDigits: zoom < 0.01 ? 4 : 1}) + '%';
  const view = $('view').value, base = current(), paired = comparable();
  document.querySelectorAll('.plane-control').forEach(e=>e.hidden=!['plane','xor'].includes(view));
  const ch=$('channel').value,bit=Number($('bit').value),key=ch+bit;
  const name=base===original?'Originale':'Sospetta';
  $('referencetitle').textContent=['plane','xor'].includes(view)?'Originale · '+key:'Originale';
  $('viewtitle').textContent=view==='diff'?'Mappa dei pixel alterati':view==='xor'?'XOR · '+key:view==='plane'?name+' · '+key:name;
  $('planeinfo').textContent='';planeBuffer=null;
  let left=paired?original:null,output=base;
  if(base&&view==='diff'&&paired){
    const data=new Uint8ClampedArray(base.data.length),n=original.hasAlpha&&suspect.hasAlpha?4:3;
    let changedCount=0,transparent=0;
    for(let i=0;i<data.length;i+=4){let changed=false;for(let c=0;c<n;c++)if(original.data[i+c]!==suspect.data[i+c])changed=true;
      const v=changed?255:0;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
      if(changed){changedCount++;if((original.hasAlpha&&original.data[i+3]===0)||(suspect.hasAlpha&&suspect.data[i+3]===0))transparent++;}}
    output=planeBuffer=artifact(data,base.width,base.height,true,'Differenze');
    $('planeinfo').textContent='Bianco = pixel alterato; nero = invariato. '+changedCount+' pixel alterati; '+transparent+' coinvolgono trasparenza totale.';
  }
  if(base&&['plane','xor'].includes(view)){
    const make=(item,ref=null)=>artifact(C.plane(item.data,ch,bit,ref?.data??null,item.hasAlpha,ref?ref.hasAlpha:item.hasAlpha),item.width,item.height,true,'Piano');
    if(paired)left=make(original);
    output=planeBuffer=make(base,view==='xor'?original:null);
    const count=item=>{let n=0;for(let i=0;i<item.data.length;i+=4)if(item.data[i]===255)n++;return n;};
    $('planeinfo').textContent=view==='xor'?'Bianco = bit modificato; nero = invariato. '+count(output)+' bit modificati.':'Bianco = 1; nero = 0. '+(left?'Originale: '+count(left)+' bit a 1 · ':'')+name+': '+count(output)+' bit a 1.';
  }
  $('saveplane').hidden=!planeBuffer;drawCanvas(reference,left);drawCanvas(canvas,output);
  renderAlterations();
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
  if (base) { selected = C.move(selected[0], selected[1], 0, 0, base.width, base.height); inspect(...selected); } else { $('pixel').replaceChildren(); pixelSwatch(null,0,0); $('x').value = 0; $('y').value = 0; mark(); }
}
function markOffset(){for(const c of [canvas,reference,$('coverpreview')]){const p=c===$('coverpreview')?'encoff':'extoff',item=p==='encoff'?original:suspect;let m=c===$('coverpreview')?$('coveroffset'):c.parentElement.querySelector('.offsetmarker');if(!m){m=document.createElement('span');m.className='offsetmarker';c.parentElement.append(m);}m.hidden=true;if(!item||c.hidden||c.parentElement.hidden||c.width!==item.width||c.height!==item.height)continue;try{const [x,y]=offset(p,item,p==='encoff'?$('encscan').value:$('scan').value),sx=c.clientWidth/c.width,sy=c.clientHeight/c.height;if(!sx||!sy)continue;m.style.left=(c.offsetLeft+x*sx)+'px';m.style.top=(c.offsetTop+y*sy)+'px';m.style.width=Math.max(5,sx)+'px';m.style.height=Math.max(5,sy)+'px';m.hidden=false;}catch{}}}
function mark() {
  for (const c of [canvas, reference]) { const marker = c.parentElement.querySelector('.marker'); marker.hidden = c.parentElement.hidden || selected[0] >= c.width || selected[1] >= c.height; marker.style.left = selected[0] * zoom + 'px'; marker.style.top = selected[1] * zoom + 'px'; marker.style.width = zoom + 'px'; marker.style.height = zoom + 'px'; } markOffset();
}
function pixelSwatch(base,x,y){const btn=$('pixelrgb');btn.disabled=!base;const color=base?Array.from(base.data.slice((y*base.width+x)*4,(y*base.width+x)*4+4)):null;$('pixelrgbcolor').style.backgroundColor=color?'rgba('+color.slice(0,3).join(',')+','+color[3]/255+')':'transparent';btn.title=color?'Esplora il colore del pixel '+(base===suspect?'sospetto':'originale')+' · RGBA ('+color.join(', ')+')':'Nessun pixel selezionato';btn.setAttribute('aria-label',btn.title);}
function revealSelected(){for(const c of [canvas,reference]){if(!c.getClientRects().length)continue;const v=c.closest('.viewport');if(!v||!v.clientWidth)continue;const r=c.getBoundingClientRect(),q=v.getBoundingClientRect();const x=r.left+selected[0]*r.width/c.width,y=r.top+selected[1]*r.height/c.height,w=r.width/c.width,h=r.height/c.height;if(x<q.left)v.scrollLeft+=x-q.left;else if(x+w>q.left+v.clientWidth)v.scrollLeft+=x+w-q.left-v.clientWidth;if(y<q.top)v.scrollTop+=y-q.top;else if(y+h>q.top+v.clientHeight)v.scrollTop+=y+h-q.top-v.clientHeight;}}
function inspect(x, y) {
  const base = current(); if (!base || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= base.width || y >= base.height) { $('pixel').textContent = 'Coordinate fuori immagine'; return; }
  selected = [x, y]; pixelSwatch(base,x,y); mark(); $('x').value = x; $('y').value = y; $('x').max=base.width-1; $('y').max=base.height-1; const same = comparable(), showOriginal = original && (same || base === original), showSuspect = suspect && (same || base === suspect);
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

const panSuppressed = new WeakSet();
const panCanvases = [canvas, reference];
const panViewport = c => c.parentElement.parentElement;
function canPan(c){const v=panViewport(c);return !c.parentElement.hidden&&(v.scrollWidth>v.clientWidth+1||v.scrollHeight>v.clientHeight+1);}
function syncPan(c){if(!comparable())return;const from=panViewport(c),other=panViewport(c===canvas?reference:canvas);if(other===from)return;if(Math.abs(other.scrollLeft-from.scrollLeft)>1)other.scrollLeft=from.scrollLeft;if(Math.abs(other.scrollTop-from.scrollTop)>1)other.scrollTop=from.scrollTop;}
for(const c of panCanvases){
 const vp=panViewport(c);let drag=null;
 vp.addEventListener('wheel',e=>{
   const unit=e.deltaMode===1?16:e.deltaMode===2?vp.clientHeight:1;
   if(e.ctrlKey||e.metaKey){
     e.preventDefault();if(c.parentElement.hidden||!e.deltaY)return;
     const before=c.getBoundingClientRect(), vr=vp.getBoundingClientRect();
     const px=Math.max(0,Math.min(c.width,(e.clientX-before.left)/zoom)),py=Math.max(0,Math.min(c.height,(e.clientY-before.top)/zoom));
     const slider=$('zoom'),next=Math.max(Number(slider.min),Math.min(Number(slider.max),Math.log(zoom)-e.deltaY*unit*.002));
     autoFit=false;slider.value=String(next);zoom=Math.exp(Number(slider.value));render();
     const after=c.getBoundingClientRect();vp.scrollLeft+=after.left+px*zoom-e.clientX;vp.scrollTop+=after.top+py*zoom-e.clientY;syncPan(c);
     c.classList.toggle('can-pan',canPan(c));
   }else if(e.shiftKey){e.preventDefault();vp.scrollLeft+=(e.deltaX||e.deltaY)*unit;syncPan(c);}
   else if(canPan(c)){e.preventDefault();vp.scrollLeft+=e.deltaX*unit;vp.scrollTop+=e.deltaY*unit;syncPan(c);}
 },{passive:false});

 c.addEventListener('pointerenter',()=>{c.classList.toggle('can-pan',canPan(c));});
 c.addEventListener('pointerdown',e=>{panSuppressed.delete(c);if(e.button!==0||!canPan(c))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:vp.scrollLeft,top:vp.scrollTop,moved:false};});
 c.addEventListener('pointermove',e=>{c.classList.toggle('can-pan',canPan(c));if(!drag||drag.id!==e.pointerId)return;if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<4)return;if(!drag.moved){drag.moved=true;c.setPointerCapture(e.pointerId);c.classList.add('panning');}vp.scrollLeft=drag.left-(e.clientX-drag.x);vp.scrollTop=drag.top-(e.clientY-drag.y);syncPan(c);e.preventDefault();});
 const end=e=>{if(!drag||drag.id!==e.pointerId)return;if(drag.moved)panSuppressed.add(c);drag=null;c.classList.remove('panning');if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);};
 c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('lostpointercapture',end);
 c.addEventListener('pointerleave',()=>{if(drag&&!drag.moved)drag=null;});
}
for (const c of [canvas, reference]) {
  c.onclick = e => { if (panSuppressed.has(c)) { panSuppressed.delete(c); return; } c.focus({preventScroll: true}); const r = c.getBoundingClientRect(); if (r.width && r.height) inspect(Math.floor((e.clientX - r.left) * c.width / r.width), Math.floor((e.clientY - r.top) * c.height / r.height)); };
  c.onkeydown = e => { const d = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[e.key], base = current(); if (!d || !base) return; e.preventDefault(); inspect(...C.move(...selected, ...d, base.width, base.height));
    for (const v of [canvas, reference]) { if (v.parentElement.hidden) continue; const vp = v.parentElement.parentElement, x = selected[0] * zoom, y = selected[1] * zoom; if (x < vp.scrollLeft) vp.scrollLeft = x; else if (x + zoom > vp.scrollLeft + vp.clientWidth) vp.scrollLeft = x + zoom - vp.clientWidth; if (y < vp.scrollTop) vp.scrollTop = y; else if (y + zoom > vp.scrollTop + vp.clientHeight) vp.scrollTop = y + zoom - vp.clientHeight; }
  };
}
for(const id of ['x','y']){$(id).oninput=()=>{const b=current();if(!b)return;const x=$('x'),y=$('y');x.max=b.width-1;y.max=b.height-1;const a=x.valueAsNumber,c=y.valueAsNumber;if(!Number.isInteger(a)||!Number.isInteger(c)||a<0||c<0||a>=b.width||c>=b.height){pixelSwatch(null,0,0);$('pixel').textContent='Inserisci coordinate valide: X 0–'+(b.width-1)+', Y 0–'+(b.height-1);return;}inspect(a,c);revealSelected();};$(id).onblur=()=>{const b=current();if(!b)return;const x=$('x').valueAsNumber,y=$('y').valueAsNumber;inspect(Math.max(0,Math.min(b.width-1,Number.isFinite(x)?Math.trunc(x):selected[0])),Math.max(0,Math.min(b.height-1,Number.isFinite(y)?Math.trunc(y):selected[1])));revealSelected();};} $('next').onclick = () => { const b = current(); if (b) { const n = selected[1] * b.width + selected[0] + 1; if (n < b.width * b.height) inspect(n % b.width, Math.floor(n / b.width)); } };
$('saveplane').onclick = () => { try { if (planeBuffer) downloadPng(planeBuffer, 'piano.png'); } catch (e) { say(e.message); } };
$('undo').onclick = () => { bits = bits.slice(0, -1); bitSources.pop(); showBits(); }; $('clear').onclick = () => { bits = ''; bitSources = []; showBits(); };
$('extract').onclick = () => { try { if (!suspect) throw Error('Carica una sospetta'); const n = Number($('count').value); if (!Number.isInteger(n) || n < 1 || n > 65536) throw Error('Limite: 1–65536 bit'); bits = C.extract(suspect.data, suspect.width, suspect.height, $('order').value, $('scan').value, Number($('extractbit').value), n, suspect.hasAlpha,...offset('extoff',suspect,$('scan').value)); bitSources = []; for (const p of C.positions(suspect.width, suspect.height, $('order').value, $('scan').value, suspect.hasAlpha,...offset('extoff',suspect,$('scan').value))) { if (bitSources.length === n) break; const pixel = Math.floor(p / 4); bitSources.push({x:pixel % suspect.width,y:Math.floor(pixel / suspect.width),channel:'RGBA'[p % 4],bit:Number($('extractbit').value)}); } showBits(); } catch (e) { say(e.message); } };
$('decode').onclick = () => { try { $('decoded').textContent = C.decode(bits); } catch (e) { if (bits.length % 8) { $('decoded').textContent = 'Servono gruppi completi di 8 bit. Bit residui: ' + (bits.length % 8) + '.'; return; } const bytes = Uint8Array.from(bits.match(/.{8}/g) || [], s => parseInt(s, 2)); const preview = new TextDecoder('utf-8').decode(bytes); $('decoded').textContent = 'Sequenza UTF-8 non valida. Verifica numero di bit, ordine dei canali, posizione del bit, offset e scansione.\nAnteprima indicativa (� = sequenza non valida): ' + preview; } };
function created(data, name) {
  const result = artifact(data, original.width, original.height, original.hasAlpha, name); invalidate('suspect'); suspect = result; generatedPair = {original, result}; setMode('manual', true); $('brief').textContent = 'Reperto creato nel laboratorio.'; $('view').value = 'suspect'; state('suspect', 'Generato: ' + describe(result)); autoFit = true; render(); say('Anteprima generata. Puoi scaricare il PNG quando vuoi.');
}


$('report').onclick = () => download(new Blob(['# Relazione SteganoLab\n\n' + $('brief').textContent + '\n\n' + $('notes').value + '\n\nBit: ' + bits + '\n\nDecodifica: ' + $('decoded').textContent], {type: 'text/markdown'}), 'relazione.md');
const steps = ['Confronta i reperti e formula una prima ipotesi.', 'Attiva Mappa dei pixel alterati e osserva dove si concentrano le alterazioni.', 'Ispeziona almeno cinque pixel: quali bit cambiano?', 'Raccogli i bit della sospetta, anche quelli invariati.', 'Decodifica i byte e verifica la tua ipotesi.', 'Scrivi ed esporta la relazione.'];
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
$('downloadcreated').onclick = async () => {
  if(!generatedPair || generatedPair.original!==original || generatedPair.result!==suspect) return;
  const item=generatedPair.result;
  try {
    if(typeof window.showSaveFilePicker==='function'){
      try {
        const handle=await window.showSaveFilePicker({suggestedName:'reperto.png',types:[{description:'Immagine PNG',accept:{'image/png':['.png']}}],excludeAcceptAllOption:true});
        const blob=new Blob([PngCodec.encode(item)],{type:'image/png'});
        const stream=await handle.createWritable();await stream.write(blob);await stream.close();return;
      } catch(e){if(e.name==='AbortError')return;if(e.name!=='SecurityError'&&e.name!=='NotAllowedError')throw e;}
    }
    const input=window.prompt('Nome del file PNG da scaricare:', 'reperto.png');
    if(input===null)return;
    const name=input.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/\.png$/i,'').trim();
    if(!name){say('Inserisci un nome valido per il file.');return;}
    downloadPng(item,name+'.png');
  }catch(e){say('Salvataggio non riuscito: '+e.message);}
};
$('analysecreated').onclick = () => { if (!generatedPair || generatedPair.original !== original || generatedPair.result !== suspect) { say('Genera prima un reperto'); return; } setMode('manual', true); switchTab(0); $('view').value = 'suspect'; render(); tabs[0].focus(); };
const controls = 'NUL SOH STX ETX EOT ENQ ACK BEL BS HT LF VT FF CR SO SI DLE DC1 DC2 DC3 DC4 NAK SYN ETB CAN EM SUB ESC FS GS RS US'.split(' '), ascii = $('ascii');
const utfEncoder=new TextEncoder();
function utfValues(ch){const cp=ch.codePointAt(0),bytes=Array.from(utfEncoder.encode(ch));return [cp<32?controls[cp]:cp===32?'SP (spazio)':cp===127?'DEL':ch,'U+'+cp.toString(16).toUpperCase().padStart(4,'0'),bytes.join(' '),bytes.map(b=>b.toString(2).padStart(8,'0')).join(' '),bytes.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')];}
function utfRow(body,values){const row=body.insertRow();for(const v of values)row.insertCell().textContent=v;}
function utfMatches(ch,values,query,caseSensitive){const q=query.trim();if(!q)return true;const norm=s=>caseSensitive?s:s.toLowerCase();if(Array.from(q).length===1&&!/^[0-9]$/.test(q))return norm(ch)===norm(q);if(/^U\+[0-9a-f]+$/i.test(q))return parseInt(q.slice(2),16)===ch.codePointAt(0);if(/^0x[0-9a-f]{2}(?:\s+(?:0x)?[0-9a-f]{2})*$/i.test(q))return values[4]===q.replace(/0x/gi,'').toUpperCase().replace(/\s+/g,' ');const code=q.toUpperCase().replace(/\s+/g,' ');return norm(values[0]).includes(norm(q))||values.slice(2).some(v=>v===code);}
function filterAscii(){const q=$('asciisearch').value,cs=$('asciicase').checked;ascii.replaceChildren();const chars=[...Array.from({length:128},(_,i)=>String.fromCodePoint(i)),...new Set(Array.from('àèéìòùÀÈÉÌÒÙäöüñçß€£©®°–—…αβΩ中😀'))];let count=0;for(const ch of chars){const values=utfValues(ch);if(utfMatches(ch,values,q,cs)){utfRow(ascii,values);count++;}}$('asciiresults').textContent=count+' risultati';}
function renderUtf(){const value=$('utftext').value,chars=Array.from(value),n=utfEncoder.encode(value).length,body=$('utfrows');body.replaceChildren();for(const ch of chars.slice(0,512))utfRow(body,utfValues(ch));$('utfsummary').textContent=chars.length+' punti di codice · '+n+' byte · '+(n*8)+' bit'+(chars.length>512?' (primi 512 mostrati)':'');}
$('utftext').oninput=renderUtf;$('asciisearch').oninput=filterAscii;$('asciicase').onchange=filterAscii;for(const id of ['openascii','asciinear'])$(id).onclick=()=>{$('asciisearch').value='';filterAscii();renderUtf();$('asciidialog').showModal();$('utftext').focus();};$('closeascii').onclick=()=>$('asciidialog').close();
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

let maskOwner=null, savedPlanes=new Map(), draftPlanes=new Map(), planeKey='R0', working=null, undoPlane=[], redoPlane=[], editOwner=null;
const mc=$('maskeditor'), md=$('maskdialog'), mv=$('maskviewport'), mw=$('maskwrap');
function refreshMaskOwner(){if(maskOwner!==original){maskOwner=original;savedPlanes=new Map();if(md.open)md.close();}const n=[...savedPlanes.values()].filter(p=>p.active).length;$('openmasks').disabled=!original;$('masksummary').textContent=n+' maschere attive · '+savedPlanes.size+' salvate'+(n?' · '+[...savedPlanes].filter(([k,p])=>p.active).map(([k])=>k).join(', '):'');}
function stashPlane(){if(working)draftPlanes.set(planeKey,working);}
function originalMaskPlane(item,key){const c='RGBA'.indexOf(key[0]),b=Number(key[1]),data=new Uint8Array(item.width*item.height);for(let i=0;i<data.length;i++)data[i]=(item.data[i*4+c]>>>b)&1;return data;}
function selectMaskPlane(key){stashPlane();planeKey=key;working=draftPlanes.get(key)||{data:originalMaskPlane(editOwner,key),active:false};undoPlane=[];redoPlane=[];drawMaskEditor();}
let maskPreviewData=null,maskPreviewFrame=0;
function maskViews(){return [mv,$('maskoriginalviewport'),$('maskresultviewport')].filter(v=>!v.closest('[hidden]'));}
function syncMaskViews(source){for(const v of maskViews())if(v!==source){if(v.scrollLeft!==source.scrollLeft)v.scrollLeft=source.scrollLeft;if(v.scrollTop!==source.scrollTop)v.scrollTop=source.scrollTop;}}
for(const v of [mv,$('maskoriginalviewport'),$('maskresultviewport')]){
 v.addEventListener('scroll',()=>{if(maskViews().includes(v))syncMaskViews(v);});
 v.addEventListener('wheel',e=>{if(!working)return;const unit=e.deltaMode===1?16:e.deltaMode===2?v.clientHeight:1;e.preventDefault();if(e.ctrlKey||e.metaKey){const c=v.querySelector('canvas'),r=c.getBoundingClientRect(),z=Number($('maskzoom').value),x=(e.clientX-r.left)/z,y=(e.clientY-r.top)/z;const slider=$('maskzoom');slider.value=String(Math.max(.05,Math.min(32,z*Math.exp(-e.deltaY*unit*.002))));drawMaskEditor();const next=Number(slider.value),after=c.getBoundingClientRect();v.scrollLeft+=after.left+x*next-e.clientX;v.scrollTop+=after.top+y*next-e.clientY;}else if(e.shiftKey)v.scrollLeft+=(e.deltaX||e.deltaY)*unit;else{v.scrollLeft+=e.deltaX*unit;v.scrollTop+=e.deltaY*unit;}syncMaskViews(v);},{passive:false});
 if(v!==mv){const c=v.querySelector('canvas');let drag=null;c.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:v.scrollLeft,t:v.scrollTop};c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;v.scrollLeft=drag.l+drag.x-e.clientX;v.scrollTop=drag.t+drag.y-e.clientY;syncMaskViews(v);});for(const event of ['pointerup','pointercancel','lostpointercapture'])c.addEventListener(event,()=>{drag=null;});}
}
$('maskshoworiginal').onchange=()=>{$('maskoriginalpanel').hidden=!$('maskshoworiginal').checked;requestAnimationFrame(()=>syncMaskViews(mv));};
for(const btn of document.querySelectorAll('[data-masktool]'))btn.onclick=()=>{$('masktool').value=btn.dataset.masktool;$('masktool').onchange();};
$('masktool').onchange=()=>{for(const btn of document.querySelectorAll('[data-masktool]'))btn.setAttribute('aria-pressed',String(btn.dataset.masktool===$('masktool').value));mc.classList.toggle('maskpanmode',$('masktool').value==='pan');maskCursor(-1,-1);};
$('maskbrush').oninput=()=>{$('maskbrushvalue').textContent=$('maskbrush').value+' px';maskCursor(-1,-1);};
$('maskfit').onclick=()=>{if(!working)return;const z=Math.min(...maskViews().map(v=>Math.min(v.clientWidth/editOwner.width,v.clientHeight/editOwner.height)));$('maskzoom').value=String(Math.max(.05,Math.min(32,Math.floor(z*20)/20)));drawMaskEditor();mv.scrollLeft=mv.scrollTop=0;syncMaskViews(mv);};
function maskPreviewStats(){if(!maskPreviewData||!editOwner)return;let pixels=0,bits=0,max=0;const a=editOwner.data,b=maskPreviewData.data;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){let x=a[i+c]^b[i+c];if(x){changed=true;max=Math.max(max,Math.abs(a[i+c]-b[i+c]));while(x){bits+=x&1;x>>>=1;}}}if(changed)pixels++;} $('maskpreviewstats').textContent=pixels.toLocaleString('it-IT')+' pixel alterati ('+(100*pixels/(a.length/4)).toLocaleString('it-IT',{maximumFractionDigits:2})+'%) · '+bits.toLocaleString('it-IT')+' bit modificati · variazione massima '+max;}
function refreshMaskPreview(){const w=editOwner.width,h=editOwner.height,z=Number($('maskzoom').value),planes=new Map(draftPlanes);planes.set(planeKey,working);const result=applyBinaryPlanes(editOwner.data,planes,editOwner.hasAlpha);maskPreviewData=new ImageData(new Uint8ClampedArray(result),w,h);for(const [id,data] of [['maskoriginal',new ImageData(new Uint8ClampedArray(editOwner.data),w,h)],['maskresult',maskPreviewData]]){const c=$(id),wrap=c.parentElement;c.width=w;c.height=h;c.style.width=w*z+'px';c.style.height=h*z+'px';wrap.style.width=w*z+'px';wrap.style.height=h*z+'px';wrap.style.setProperty('--mz',z+'px');wrap.classList.toggle('maskgridded',$('maskgrid').checked&&z>=2);c.getContext('2d').putImageData(data,0,0);}syncMaskViews(mv);maskPreviewStats();}
function updateMaskPreviewPixel(x,y){if(!maskPreviewData)return;const i=(y*editOwner.width+x)*4,c='RGBA'.indexOf(planeKey[0]),b=Number(planeKey[1]);maskPreviewData.data[i+c]=(maskPreviewData.data[i+c]&~(1<<b))|(working.data[i/4]<<b);$('maskresult').getContext('2d').putImageData(maskPreviewData,0,0,x,y,1,1);if(!maskPreviewFrame)maskPreviewFrame=requestAnimationFrame(()=>{maskPreviewFrame=0;maskPreviewStats();});}
function maskCursor(x,y){for(const id of ['maskoriginal','maskeditor','maskresult']){const c=$(id),wrap=c.parentElement;let marker=wrap.querySelector('.maskcursor');if(!marker){marker=document.createElement('span');marker.className='maskcursor';wrap.append(marker);}const z=Number($('maskzoom').value);marker.hidden=x<0||y<0||x>=mc.width||y>=mc.height;const n=$('masktool').value==='pan'?1:Number($('maskbrush').value),r=(n-1)/2;marker.style.left=(x-r)*z+'px';marker.style.top=(y-r)*z+'px';marker.style.width=n*z+'px';marker.style.height=n*z+'px';}}
function drawMaskEditor(){const w=editOwner.width,h=editOwner.height,z=Number($('maskzoom').value);$('maskzoomvalue').textContent=Math.round(z*100)+'%';maskCursor(-1,-1);if(mc.width!==w||mc.height!==h){mc.width=w;mc.height=h;}mc.style.width=w*z+'px';mc.style.height=h*z+'px';mw.style.width=w*z+'px';mw.style.height=h*z+'px';mw.style.setProperty('--mz',z+'px');mw.classList.toggle('maskgridded',$('maskgrid').checked&&z>=2);$('maskdimensions').textContent=w+' × '+h+' pixel · '+(w*h).toLocaleString('it-IT')+' pixel totali';const img=new ImageData(w,h);for(let i=0;i<working.data.length;i++){const v=working.data[i]*255;img.data.set([v,v,v,255],i*4);}mc.getContext('2d').putImageData(img,0,0);$('maskactive').checked=working.active;$('maskselected').textContent=planeKey[0]+' · bit '+planeKey[1];$('maskundo').disabled=!undoPlane.length;$('maskredo').disabled=!redoPlane.length;const matrix=$('maskmatrix');matrix.replaceChildren();for(const c of editOwner.hasAlpha?'RGBA':'RGB'){const row=document.createElement('div');row.className='maskmatrixrow';for(let b=7;b>=0;b--){const key=c+b,p=key===planeKey?working:draftPlanes.get(key),btn=document.createElement('button');btn.textContent=key+(p?.active?' ✓':'');btn.classList.toggle('selected',key===planeKey);btn.setAttribute('aria-pressed',String(key===planeKey));btn.onclick=()=>selectMaskPlane(key);row.append(btn);}matrix.append(row);} refreshMaskPreview(); }
function rememberMask(){undoPlane.push({data:working.data.slice(),active:working.active});if(undoPlane.length>8)undoPlane.shift();redoPlane=[];}
function changeMask(fn){rememberMask();fn(working.data);working.active=true;drawMaskEditor();}
$('openmasks').onclick=()=>{if(!original||mode!=='manual')return;editOwner=original;draftPlanes=new Map([...savedPlanes].map(([k,p])=>[k,{data:p.data.slice(),active:p.active}]));working=null;$('maskcoords').textContent='X: — · Y: — · Bit: —';planeKey='R0';$('maskeditstatus').textContent='';selectMaskPlane(planeKey);md.showModal();};
$('cancelmasks').onclick=()=>md.close();md.addEventListener('close',()=>{draftPlanes=new Map();working=null;undoPlane=[];redoPlane=[];maskPreviewData=null;if(maskPreviewFrame)cancelAnimationFrame(maskPreviewFrame);maskPreviewFrame=0;});
$('savemasks').onclick=()=>{if(original!==editOwner)return;stashPlane();savedPlanes=new Map(draftPlanes);if([...savedPlanes.values()].some(p=>p.active))$('includePlanes').checked=true;md.close();refreshMaskOwner();refreshGeneration();};
$('maskactive').onchange=()=>{rememberMask();working.active=$('maskactive').checked;drawMaskEditor();};
$('maskzoom').oninput=$('maskgrid').onchange=drawMaskEditor;
$('maskreset').onclick=()=>{rememberMask();working.data=originalMaskPlane(editOwner,planeKey);working.active=false;drawMaskEditor();};
$('maskzero').onclick=()=>changeMask(d=>d.fill(0));$('maskone').onclick=()=>changeMask(d=>d.fill(1));$('maskinvert').onclick=()=>changeMask(d=>{for(let i=0;i<d.length;i++)d[i]^=1;});
$('maskundo').onclick=()=>{if(!undoPlane.length)return;redoPlane.push(working);working=undoPlane.pop();drawMaskEditor();};$('maskredo').onclick=()=>{if(!redoPlane.length)return;undoPlane.push(working);working=redoPlane.pop();drawMaskEditor();};
let stroke=null;
function maskPoint(e){const r=mc.getBoundingClientRect();return [Math.floor((e.clientX-r.left)*mc.width/r.width),Math.floor((e.clientY-r.top)*mc.height/r.height)];}
function maskReadout(e){const [x,y]=maskPoint(e);maskCursor(x,y);$('maskcoords').textContent=working&&x>=0&&y>=0&&x<mc.width&&y<mc.height?'X: '+x+' · Y: '+y+' · Bit: '+working.data[y*mc.width+x]:'X: — · Y: — · Bit: —';}
mc.addEventListener('pointermove',maskReadout);
mc.addEventListener('pointerdown',maskReadout);
mc.addEventListener('pointerleave',()=>{maskCursor(-1,-1);$('maskcoords').textContent='X: — · Y: — · Bit: —';});
function paintMaskPixel(x,y,v){if(x<0||y<0||x>=mc.width||y>=mc.height)return;working.data[y*mc.width+x]=v;const ctx=mc.getContext('2d');ctx.fillStyle=v?'white':'black';ctx.fillRect(x,y,1,1);updateMaskPreviewPixel(x,y);}
function paintMask(x,y){const r=(stroke.size-1)/2;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const px=x+dx,py=y+dy;if(px<0||py<0||px>=mc.width||py>=mc.height)continue;const i=py*mc.width+px;if(stroke.tool==='invert'){if(stroke.visited.has(i))continue;stroke.visited.add(i);}const v=stroke.tool==='invert'?1-working.data[i]:stroke.tool==='pen'?1:0;if(working.data[i]!==v)paintMaskPixel(px,py,v);}}
mc.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();mc.setPointerCapture(e.pointerId);if(e.shiftKey||$('masktool').value==='pan'){stroke={pan:true,x:e.clientX,y:e.clientY,l:mv.scrollLeft,t:mv.scrollTop};return;}const [x,y]=maskPoint(e);if(x<0||y<0||x>=mc.width||y>=mc.height)return;rememberMask();const tool=$('masktool').value;if(!working.active){working.active=true;refreshMaskPreview();}stroke={x,y,tool,size:Number($('maskbrush').value),visited:new Set()};paintMask(x,y);maskReadout(e);};
mc.onpointermove=e=>{if(!stroke)return;if(stroke.pan){mv.scrollLeft=stroke.l+stroke.x-e.clientX;mv.scrollTop=stroke.t+stroke.y-e.clientY;syncMaskViews(mv);maskReadout(e);return;}const [x,y]=maskPoint(e),nx=Math.max(0,Math.min(mc.width-1,x)),ny=Math.max(0,Math.min(mc.height-1,y)),n=Math.max(Math.abs(nx-stroke.x),Math.abs(ny-stroke.y),1);for(let i=0;i<=n;i++)paintMask(Math.round(stroke.x+(nx-stroke.x)*i/n),Math.round(stroke.y+(ny-stroke.y)*i/n));stroke.x=nx;stroke.y=ny;maskReadout(e);};
mc.onpointerup=mc.onpointercancel=mc.onlostpointercapture=()=>{if(stroke){stroke=null;drawMaskEditor();}};

$('maskexport').onclick=()=>{const d=new Uint8Array(working.data.length*4);for(let i=0;i<working.data.length;i++){const v=working.data[i]*255;d.set([v,v,v,255],i*4);}download(new Blob([PngCodec.encode(artifact(d,editOwner.width,editOwner.height,false,'maschera.png'))],{type:'image/png'}),'maschera-'+planeKey+'.png');};
function applyBinaryPlanes(data,planes,hasAlpha){const out=new Uint8Array(data);for(const [key,p] of planes){if(!p.active)continue;const c='RGBA'.indexOf(key[0]),b=Number(key[1]);if(c<0||c>=(hasAlpha?4:3)||!Number.isInteger(b)||b<0||b>7||p.data.length!==out.length/4)throw Error('Piano non valido');for(let i=0;i<p.data.length;i++){const j=i*4+c;out[j]=(out[j]&~(1<<b))|((p.data[i]&1)<<b);}}return out;}
function generationPlan(){if(!original||mode!=='manual')throw Error('Carica l’immagine originale');const useText=$('includeText').checked && $('message').value.length>0, usePlanes=$('includePlanes').checked;const planes=new Map(usePlanes?[...savedPlanes].filter(([k,p])=>p.active):[]);if(!useText&&!planes.size)throw Error('Inserisci un testo oppure attiva e salva almeno una maschera, quindi includi il contenuto desiderato.');if(useText){const msg=$('message').value,order=$('encorder').value,bit=$('encbit').value,scan=$('encscan').value;if(!msg)throw Error('Inserisci un messaggio oppure escludi il testo');const start=offset('encoff',original,scan);if(new TextEncoder().encode(msg).length*8>(original.width*original.height-C.startIndex(original.width,original.height,scan,...start))*order.length)throw Error('Messaggio oltre la capacità');for(const c of order)if(planes.has(c+bit))throw Error('Conflitto testo/maschera sul piano '+c+bit+'; scegli un altro piano');}return {useText,planes};}
function refreshGeneration(){try{const p=generationPlan();$('generationSummary').textContent=(p.useText?'Testo UTF-8 incluso':'Testo escluso')+' · Piani inclusi: '+([...p.planes.keys()].join(', ')||'nessuno');$('encode').disabled=false;}catch(e){$('generationSummary').textContent=e.message;$('encode').disabled=true;}}
for(const id of ['includeText','includePlanes'])$(id).addEventListener('change',refreshGeneration);
$('encode').onclick=()=>{try{const p=generationPlan();let data=applyBinaryPlanes(original.data,p.planes,original.hasAlpha);if(p.useText)data=C.encode(data,original.width,original.height,$('encorder').value,$('encscan').value,Number($('encbit').value),$('message').value,original.hasAlpha,...offset('encoff',original,$('encscan').value));created(data,'reperto.png');}catch(e){say(e.message);}};
md.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase();if(k==='z'||k==='y'){e.preventDefault();const b=$(k==='y'||e.shiftKey?'maskredo':'maskundo');if(!b.disabled)b.click();}});

drawRGB(); $('load').click();
