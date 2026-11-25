/* Motore deterministico: buffer a 4 byte/pixel, con padding per RGB e alfa
 * non premoltiplicato per RGBA. Il formato nativo è dichiarato dal chiamante.
 * positions(w,h,order,scan,hasAlpha=false) -> iteratore di indici
 * encode(data,w,h,order,scan,bit,msg,hasAlpha=false) -> copia modificata
 * extract(data,w,h,order,scan,bit,n,hasAlpha=false) -> stringa di n bit
 * plane(data,channel,bit,reference=null,hasAlpha=false,
 *       referenceHasAlpha=hasAlpha) -> buffer RGBA opaco; reference abilita XOR
 * hideMask(data,mask,channel,bit,hasAlpha=false) -> copia modificata
 * diff(a,b,aHasAlpha=false,bHasAlpha=false) -> {pixels,values,max}; passando
 *   parametri di formato aggiunge channels e formatsDiffer; due RGBA confrontano
 *   anche A, coppie miste solo RGB. Senza parametri conserva la forma RGB storica.
 * order è una stringa o lista ordinata di canali distinti; scan è 'row'/'col'.
 * A richiede hasAlpha=true, anche per la reference di uno XOR su A. Per diff e
 * plane il chiamante verifica larghezza e altezza: qui si controlla la lunghezza.
 * Testo UTF-8 senza header, bit MSB-first; extract richiede lunghezza esplicita.
 * La soglia della maschera usa RGB grezzo (somma >= 384), ignorandone l'alfa.
 */
(function(root){'use strict';
const channels={R:0,G:1,B:2,A:3};
function checkAlpha(hasAlpha){if(typeof hasAlpha!=='boolean')throw Error('Formato alfa non valido');}
function checkChannel(channel,hasAlpha){checkAlpha(hasAlpha);if(typeof channel!=='string'||!Object.hasOwn(channels,channel))throw Error('Canale non valido');if(channel==='A'&&!hasAlpha)throw Error('Il canale A richiede un reperto RGBA');}
function checkBuffer(data,length){if(!data||!Number.isSafeInteger(data.length)||data.length%4||(length!==undefined&&data.length!==length))throw Error('Dimensioni incompatibili');}
function startIndex(w,h,scan,x=0,y=0){if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x>=w||y>=h)throw Error('Offset fuori immagine');return scan==='col'?x*h+y:y*w+x;}
function positions(w,h,order,scan,hasAlpha=false,x=0,y=0){
	if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||!Number.isSafeInteger(w*h*4))throw Error('Dimensioni non valide');
	checkAlpha(hasAlpha);if(!(typeof order==='string'||Array.isArray(order))||!order.length||!['row','col'].includes(scan))throw Error('Parametri non validi');
	const selected=[...order];for(const c of selected)checkChannel(c,hasAlpha);if(new Set(selected).size!==selected.length)throw Error('Canali duplicati');
	return (function*(){for(let i=startIndex(w,h,scan,x,y);i<w*h;i++){const x=scan==='col'?Math.floor(i/h):i%w,y=scan==='col'?i%h:Math.floor(i/w);for(const c of selected)yield (y*w+x)*4+channels[c];}})();
}
function checkBit(bit){if(!Number.isInteger(bit)||bit<0||bit>7)throw Error('Piano non valido');}
function extract(data,w,h,order,scan,bit,n,hasAlpha=false,x=0,y=0){checkBit(bit);const indices=positions(w,h,order,scan,hasAlpha,x,y);checkBuffer(data,w*h*4);if(!Number.isSafeInteger(n)||n<0||n>(w*h-startIndex(w,h,scan,x,y))*order.length)throw Error('Lunghezza fuori capacità');let out='';for(const p of indices){if(out.length===n)break;out+=String((data[p]>>bit)&1);}return out;}
function encode(data,w,h,order,scan,bit,msg,hasAlpha=false,x=0,y=0){checkBit(bit);const indices=positions(w,h,order,scan,hasAlpha,x,y);checkBuffer(data,w*h*4);const bytes=new TextEncoder().encode(msg);if(bytes.length*8>(w*h-startIndex(w,h,scan,x,y))*order.length)throw Error('Messaggio troppo lungo');const out=new Uint8ClampedArray(data);let i=0;for(const p of indices){if(i===bytes.length*8)break;const b=(bytes[i>>3]>>(7-i%8))&1;out[p]=(out[p]&~(1<<bit))|(b<<bit);i++;}return out;}
function decode(bits){if(!/^[01]*$/.test(bits)||bits.length%8)throw Error('Servono gruppi completi di 8 bit');return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bits.match(/.{8}/g)||[],s=>parseInt(s,2)));}
function diff(a,b,aHasAlpha=false,bHasAlpha=false){checkAlpha(aHasAlpha);checkAlpha(bHasAlpha);checkBuffer(a);checkBuffer(b,a.length);const names=aHasAlpha&&bHasAlpha?'RGBA':'RGB',counts={R:0,G:0,B:0};if(names==='RGBA')counts.A=0;let pixels=0,values=0,max=0;for(let i=0;i<a.length;i+=4){let changed=false;for(const name of names){const c=channels[name],d=Math.abs(a[i+c]-b[i+c]);if(d){changed=true;counts[name]++;values++;max=Math.max(max,d);}}if(changed)pixels++;}const result={pixels,values,max};if(arguments.length>2){result.channels=counts;result.formatsDiffer=aHasAlpha!==bHasAlpha;}return result;}
function plane(data,channel,bit,reference=null,hasAlpha=false,referenceHasAlpha=hasAlpha){checkBit(bit);checkChannel(channel,hasAlpha);checkAlpha(referenceHasAlpha);checkBuffer(data);if(reference!==null){checkChannel(channel,referenceHasAlpha);checkBuffer(reference,data.length);}const out=new Uint8ClampedArray(data.length);for(let i=0;i<data.length;i+=4){const j=i+channels[channel],v=(((data[j]^(reference!==null?reference[j]:0))>>bit)&1)*255;out.set([v,v,v,255],i);}return out;}
function hideMask(data,mask,channel,bit,hasAlpha=false){checkBit(bit);checkChannel(channel,hasAlpha);checkBuffer(data);checkBuffer(mask,data.length);const out=new Uint8ClampedArray(data);for(let i=0;i<data.length;i+=4){const j=i+channels[channel],v=(mask[i]+mask[i+1]+mask[i+2]>=384)?1:0;out[j]=(out[j]&~(1<<bit))|(v<<bit);}return out;}
function move(x,y,dx,dy,w,h){return [Math.max(0,Math.min(w-1,x+dx)),Math.max(0,Math.min(h-1,y+dy))];}
const api={startIndex,positions,extract,encode,decode,diff,plane,hideMask,move};if(typeof module!=='undefined')module.exports=api;else root.Stegano=api;
})(globalThis);