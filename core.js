/* Deterministic RGB bit operations. No network. */
(function(root){'use strict';
const channels={R:0,G:1,B:2};
function positions(w,h,order,scan){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!order.length||[...order].some(c=>!(c in channels))||new Set(order).size!==order.length||!['row','col'].includes(scan))throw Error('Parametri non validi');return (function*(){for(let i=0;i<w*h;i++){const x=scan==='col'?Math.floor(i/h):i%w,y=scan==='col'?i%h:Math.floor(i/w);for(const c of order)yield (y*w+x)*4+channels[c];}})();}
function checkBit(bit){if(!Number.isInteger(bit)||bit<0||bit>7)throw Error('Piano non valido');}
function extract(data,w,h,order,scan,bit,n){checkBit(bit);if(!Number.isInteger(n)||n<0||n>w*h*order.length)throw Error('Lunghezza fuori capacità');let out='';for(const p of positions(w,h,order,scan)){if(out.length===n)break;out+=String((data[p]>>bit)&1);}return out;}
function encode(data,w,h,order,scan,bit,msg){checkBit(bit);const bytes=new TextEncoder().encode(msg);if(bytes.length*8>w*h*order.length)throw Error('Messaggio troppo lungo');const out=new Uint8ClampedArray(data);let i=0;for(const p of positions(w,h,order,scan)){if(i===bytes.length*8)break;const b=(bytes[i>>3]>>(7-i%8))&1;out[p]=(out[p]&~(1<<bit))|(b<<bit);i++;}return out;}
function decode(bits){if(!/^[01]*$/.test(bits)||bits.length%8)throw Error('Servono gruppi completi di 8 bit');return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bits.match(/.{8}/g)||[],s=>parseInt(s,2)));}
function diff(a,b){if(a.length!==b.length||a.length%4)throw Error('Dimensioni incompatibili');let pixels=0,values=0,max=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);if(d){changed=true;values++;max=Math.max(max,d);}}if(changed)pixels++;}return {pixels,values,max};}
const api={positions,extract,encode,decode,diff};if(typeof module!=='undefined')module.exports=api;else root.Stegano=api;
})(globalThis);