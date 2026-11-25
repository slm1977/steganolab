'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const codec = require('../png-codec.js');
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name));
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
// Generatore di test indipendente: zlib Node, CRC bit-per-bit e filtri propri.
function crc(bytes) {
  let c = -1;
  for (const byte of bytes) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ -1) >>> 0;
}
function chunk(type, data = Buffer.alloc(0)) {
  const t = Buffer.from(type, 'ascii'), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); t.copy(out, 4); Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, -4)), out.length - 4); return out;
}
function ihdr(w = 1, h = 1, type = 6, depth = 8, interlace = 0) {
  const b = Buffer.alloc(13); b.writeUInt32BE(w); b.writeUInt32BE(h, 4); b[8] = depth; b[9] = type; b[12] = interlace; return b;
}
function png(parts) { return Buffer.concat([signature, ...parts]); }
function make(w, h, type, raw, extra = []) {
  return png([chunk('IHDR', ihdr(w, h, type)), ...extra, chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND')]);
}
function mustReject(buffer, pattern) { assert.throws(() => codec.decode(buffer), pattern); }
function paeth(a, b, c) {
  const p = a + b - c, d = [Math.abs(p-a),Math.abs(p-b),Math.abs(p-c)];
  return d[0] <= d[1] && d[0] <= d[2] ? a : d[1] <= d[2] ? b : c;
}
function filtered(rows, bpp) {
  const stride = rows[0].length, out = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y], prev = rows[y-1] || Buffer.alloc(stride), filter = y % 5;
    out.push(filter);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x-bpp] : 0, b = prev[x], c = x >= bpp ? prev[x-bpp] : 0;
      const pred = [0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      out.push((row[x] - pred + 256) % 256);
    }
  }
  return Buffer.from(out);
}
function checkIndependent(bytes, pixels, width, height, type) {
  const result = spawnSync('convert', ['png:-', '-depth', '8', type === 2 ? 'rgb:-' : 'rgba:-'], { input: bytes, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw new Error('ImageMagick convert necessario per la verifica indipendente: ' + result.error.message);
  assert.equal(result.status, 0, String(result.stderr));
  const expected = [];
  for (let i=0; i<pixels.length; i+=4) { expected.push(pixels[i],pixels[i+1],pixels[i+2]); if (type===6) expected.push(pixels[i+3]); }
  assert.deepEqual(result.stdout, Buffer.from(expected), 'decoder ImageMagick');
  assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height);
  assert.equal(bytes[24], 8); assert.equal(bytes[25], type);
}
const alphaExpected = Uint8ClampedArray.from([173,135,185,255,173,135,185,128,173,135,185,1,173,135,185,0]);
const alpha = codec.decode(fixture('rgba-alpha-imagemagick.png'));
assert.deepEqual(alpha.data, alphaExpected); assert.equal(alpha.hasAlpha, true); assert.equal(alpha.hasTransparency, true);
const rgbExpected = Uint8ClampedArray.from([1,2,3,255,128,127,254,255,255,0,42,255,17,36,67,255,100,133,166,255,199,232,9,255]);
const rgb = codec.decode(fixture('rgb-imagemagick.png'));
assert.deepEqual(rgb.data, rgbExpected); assert.equal(rgb.hasAlpha, false); assert.equal(rgb.hasTransparency, false);
for (const image of [alpha, rgb]) {
  const before = image.data.slice(), bytes = Buffer.from(codec.encode(image));
  assert.deepEqual(image.data, before); assert.deepEqual(codec.decode(bytes).data, before);
  checkIndependent(bytes, before, image.width, image.height, image.colorType);
}
const opaque = {width:2,height:1,colorType:6,data:Uint8ClampedArray.of(12,34,56,255,78,90,123,255)};
const opDecoded = codec.decode(codec.encode(opaque));
assert.equal(opDecoded.colorType,6); assert.equal(opDecoded.hasAlpha,true); assert.equal(opDecoded.hasTransparency,false);
checkIndependent(Buffer.from(codec.encode(opaque)),opaque.data,2,1,6);
// Tutte le 65536 coppie valore/alfa; i tre canali hanno valori diversi.
const exhaustive = new Uint8ClampedArray(256*256*4);
for (let value=0;value<256;value++) for (let a=0;a<256;a++) {
  const p=(value*256+a)*4; exhaustive.set([value,255-value,(value*37+11)&255,a],p);
}
const all = {width:256,height:256,colorType:6,data:exhaustive};
const allPng = Buffer.from(codec.encode(all));
assert.deepEqual(codec.decode(allPng).data, exhaustive);
checkIndependent(allPng,exhaustive,256,256,6);
// Tutti e cinque i filtri su più righe e i due tipi, prodotti con zlib Node.
for (const type of [2,6]) {
  const bpp = type===2 ? 3 : 4, rows = [];
  for (let y=0;y<10;y++) rows.push(Buffer.from(Array.from({length:7*bpp},(_,x)=>(x*53+y*71)&255)));
  const input = make(7,10,type,filtered(rows,bpp)), decoded = codec.decode(input), expected=[];
  for (const row of rows) for (let i=0;i<row.length;i+=bpp) expected.push(row[i],row[i+1],row[i+2],bpp===4?row[i+3]:255);
  assert.deepEqual(decoded.data,Uint8ClampedArray.from(expected));
  checkIndependent(input,decoded.data,7,10,type);
}
// IDAT multipli, chunk accessori, e viste con offset.
const z = zlib.deflateSync(Buffer.from([0,5,6,7,8]));
const split = png([chunk('IHDR',ihdr()),chunk('tEXt',Buffer.from('x\0y')),chunk('IDAT',z.subarray(0,3)),chunk('IDAT',z.subarray(3)),chunk('IEND')]);
assert.deepEqual([...codec.decode(split).data],[5,6,7,8]);
const wrapper = Buffer.concat([Buffer.from([1,2]),split,Buffer.from([3])]);
assert.deepEqual([...codec.decode(wrapper.subarray(2,-1)).data],[5,6,7,8]);
assert.deepEqual([...codec.decode(Uint8Array.from(split).buffer).data],[5,6,7,8]);
assert.throws(()=>codec.decode('png'),/Input/);
mustReject(Buffer.from('not a png'),/Firma/);
mustReject(Buffer.alloc(64*1024*1024+1),/troppo grande/);
mustReject(split.subarray(0,-1),/troncato|Lunghezza|incompleto/);
const badCrc = Buffer.from(split); badCrc[20] ^= 1; mustReject(badCrc,/CRC/);
const hugeChunk = Buffer.from(split); hugeChunk.writeUInt32BE(0x7fffffff,8); mustReject(hugeChunk,/Lunghezza/);
for (const [w,h] of [[0,1],[1,0],[4000001,1],[2001,2000],[0xffffffff,1]]) mustReject(png([chunk('IHDR',ihdr(w,h)),chunk('IEND')]),/Dimensioni/);
for (const type of [0,3,4,1,5,7]) mustReject(png([chunk('IHDR',ihdr(1,1,type)),chunk('IEND')]),/Tipo colore/);
for (const depth of [1,2,4,16]) mustReject(png([chunk('IHDR',ihdr(1,1,2,depth)),chunk('IEND')]),/Profondità/);
mustReject(png([chunk('IHDR',ihdr(1,1,6,8,1)),chunk('IEND')]),/interlacciato/);
for (const type of ['acTL','fcTL','fdAT']) mustReject(png([chunk('IHDR',ihdr()),chunk(type),chunk('IEND')]),/APNG/);
mustReject(png([chunk('IHDR',ihdr(1,1,2)),chunk('tRNS',Buffer.alloc(6)),chunk('IEND')]),/tRNS/);
mustReject(png([chunk('IHDR',ihdr()),chunk('ABCD'),chunk('IEND')]),/critico/);
mustReject(png([chunk('IHDR',ihdr()),chunk('ABcD'),chunk('IEND')]),/Tipo chunk/);
mustReject(png([chunk('IDAT',z),chunk('IEND')]),/IHDR/);
mustReject(png([chunk('IHDR',ihdr()),chunk('IHDR',ihdr()),chunk('IDAT',z),chunk('IEND')]),/IHDR/);
mustReject(png([chunk('IHDR',ihdr()),chunk('IDAT',z),chunk('tEXt'),chunk('IDAT'),chunk('IEND')]),/consecutivi/);
mustReject(png([chunk('IHDR',ihdr()),chunk('PLTE',Buffer.alloc(2)),chunk('IEND')]),/PLTE/);
mustReject(png([chunk('IHDR',ihdr()),chunk('IDAT',z)]),/incompleto/);
mustReject(Buffer.concat([split,Buffer.of(0)]),/IEND/);
mustReject(make(1,1,6,Buffer.from([5,0,0,0,0])),/Filtro/);
mustReject(make(1,1,6,Buffer.alloc(4)),/Dimensione dati/);
mustReject(make(1,1,6,Buffer.alloc(1000000)),/oltre il limite/);
function withZ(compressed) {return png([chunk('IHDR',ihdr()),chunk('IDAT',compressed),chunk('IEND')]);}
mustReject(withZ(z.subarray(0,-1)),/checksum|troncato|superflui/);
const badAdler=Buffer.from(z);badAdler[badAdler.length-1]^=1;mustReject(withZ(badAdler),/Adler/);
mustReject(withZ(Buffer.concat([z,Buffer.of(0)])),/superflui/);
mustReject(withZ(Buffer.concat([z,zlib.deflateSync(Buffer.alloc(0))])),/superflui/);
mustReject(withZ(zlib.gzipSync(Buffer.from([0,5,6,7,8]))),/zlib/);
const damage=Buffer.from(z);damage[2]^=255;mustReject(withZ(damage),/DEFLATE|Adler|Dimensione/);
for (const image of [null,{}, {width:0,height:1,colorType:2,data:new Uint8Array(4)}, {width:4000001,height:1,colorType:2,data:new Uint8Array(4)}, {width:1,height:1,colorType:3,data:new Uint8Array(4)}, {width:1,height:1,colorType:6,bitDepth:16,data:new Uint8Array(4)}, {width:1,height:1,colorType:6,hasAlpha:false,data:new Uint8Array(4)}, {width:1,height:1,colorType:2,data:Uint8Array.of(1,2,3,0)}, {width:1,height:1,colorType:6,data:[1,2,3,4]}, {width:1,height:1,colorType:6,data:new Uint8Array(3)}]) assert.throws(()=>codec.encode(image));
// Simula il caricamento browser senza require/module e senza rete.
const context = vm.createContext({Uint8Array,Uint8ClampedArray,Uint32Array,ArrayBuffer,Math,Number,Object,Error,String});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/pako-2.1.0.min.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../png-codec.js'),'utf8'),context);
assert.ok(context.PngCodec); assert.deepEqual([...context.PngCodec.decode(context.PngCodec.encode(opaque)).data],[...opaque.data]);
console.log('PNG codec: fixture ImageMagick, 65536 coppie valore/alfa, filtri, CRC, limiti, errori, interoperabilità e UMD superati');
