/* Codec PNG statico RGB/RGBA a 8 bit; nessuna conversione di colore o Canvas.
 * Browser: caricare prima vendor/pako-2.1.0.min.js, poi questo file.
 * Node: require('./png-codec.js'). API sincrona: decode(ArrayBuffer o vista
 * Uint8Array), encode({width,height,data,colorType,bitDepth?}). Il buffer data
 * è sempre RGBA non premoltiplicato; RGB richiede padding alfa 255.
 * I metadati accessori non sono conservati: l'anteprima può differire da un
 * visualizzatore con gestione gamma/ICC. Vedere vendor/README.md per i limiti.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/pako-2.1.0.min.js'));
  } else {
    root.PngCodec = factory(root.pako);
  }
})(globalThis, function (pako) {
  'use strict';
  if (!pako || !pako.Inflate || !pako.deflate) throw new Error('Pako 2.1.0 non disponibile');
  const MAX_PIXELS = 4000000, MAX_FILE_BYTES = 64 * 1024 * 1024, MAX_CHUNKS = 100000;
  const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    crcTable[n] = c >>> 0;
  }
  function crc32(bytes, start, end) {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function read32(a, i) { return ((a[i] * 0x1000000) + (a[i + 1] << 16) + (a[i + 2] << 8) + a[i + 3]) >>> 0; }
  function write32(a, i, v) { a[i] = v >>> 24; a[i + 1] = v >>> 16; a[i + 2] = v >>> 8; a[i + 3] = v; }
  function dimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 0x7fffffff || height > 0x7fffffff || width * height > MAX_PIXELS) {
      throw new Error('Dimensioni PNG non valide: massimo 4 milioni di pixel');
    }
  }
  function bytesOf(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input instanceof Uint8Array || input instanceof Uint8ClampedArray) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    throw new Error('Input PNG: atteso ArrayBuffer o array di byte');
  }
  function adler32(a) {
    let x = 1, y = 0;
    for (let i = 0; i < a.length;) {
      const end = Math.min(i + 5552, a.length);
      while (i < end) { x += a[i++]; y += x; }
      x %= 65521; y %= 65521;
    }
    return ((y << 16) | x) >>> 0;
  }
  function inflateBounded(input, expected) {
    if (input.length < 6) throw new Error('Flusso zlib troncato');
    const cmf = input[0], flg = input[1];
    if ((cmf & 15) !== 8 || (cmf >>> 4) > 7 || ((cmf << 8) | flg) % 31 || (flg & 32)) throw new Error('Intestazione zlib non valida');
    // Raw DEFLATE evita l'accettazione automatica di flussi zlib concatenati di Pako.
    const inflator = new pako.Inflate({ raw: true, chunkSize: Math.min(65536, expected + 1) });
    const out = new Uint8Array(expected);
    let written = 0;
    inflator.onData = chunk => {
      if (chunk.length > expected - written) throw new Error('Dati decompressi oltre il limite atteso');
      out.set(chunk, written); written += chunk.length;
    };
    const payload = input.subarray(2);
    if (!inflator.push(payload, true) || inflator.err || !inflator.ended) throw new Error('Flusso DEFLATE corrotto o troncato');
    const offset = inflator.strm.next_in + 2;
    if (input.length - offset !== 4) throw new Error('Dati superflui o checksum zlib mancante');
    if (written !== expected) throw new Error('Dimensione dati decompressi PNG non valida');
    if (read32(input, offset) !== adler32(out)) throw new Error('Checksum Adler-32 non valido');
    return out;
  }
  function paeth(a, b, c) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  function decode(input) {
    const file = bytesOf(input);
    if (file.length > MAX_FILE_BYTES) throw new Error('File PNG troppo grande: massimo 64 MiB');
    if (file.length < 8 || !SIGNATURE.every((v, i) => file[i] === v)) throw new Error('Firma PNG non valida');
    let pos = 8, count = 0, width, height, colorType, bitDepth, channels;
    let seenIHDR = false, seenPLTE = false, seenIDAT = false, idatClosed = false, ended = false, total = 0;
    const idats = [];
    while (pos < file.length) {
      if (++count > MAX_CHUNKS) throw new Error('Troppi chunk PNG');
      if (file.length - pos < 12) throw new Error('Chunk PNG troncato');
      const len = read32(file, pos), start = pos + 8, end = start + len;
      if (len > 0x7fffffff || end + 4 > file.length) throw new Error('Lunghezza chunk PNG non valida');
      const typeBytes = file.subarray(pos + 4, start);
      if (!typeBytes.every(c => c >= 65 && c <= 90 || c >= 97 && c <= 122) || (typeBytes[2] & 32)) throw new Error('Tipo chunk PNG non valido');
      const type = String.fromCharCode(...typeBytes);
      if (crc32(file, pos + 4, end) !== read32(file, end)) throw new Error('CRC PNG non valido: ' + type);
      if (!seenIHDR && type !== 'IHDR') throw new Error('IHDR deve essere il primo chunk');
      if (seenIDAT && type !== 'IDAT') idatClosed = true;
      if (type === 'IHDR') {
        if (seenIHDR || len !== 13) throw new Error('IHDR PNG non valido');
        seenIHDR = true; width = read32(file, start); height = read32(file, start + 4);
        dimensions(width, height); bitDepth = file[start + 8]; colorType = file[start + 9];
        if (colorType !== 2 && colorType !== 6) throw new Error('Tipo colore PNG ' + colorType + ' non supportato: servono RGB (2) o RGBA (6)');
        if (bitDepth !== 8) throw new Error('Profondità PNG ' + bitDepth + ' non supportata: servono 8 bit per canale');
        if (file[start + 10] !== 0 || file[start + 11] !== 0) throw new Error('Compressione o filtro PNG non supportati');
        if (file[start + 12] !== 0) throw new Error('PNG interlacciato Adam7 non supportato');
        channels = colorType === 2 ? 3 : 4;
      } else if (type === 'PLTE') {
        if (seenPLTE || seenIDAT || !len || len > 768 || len % 3) throw new Error('PLTE PNG non valido');
        seenPLTE = true;
      } else if (type === 'tRNS') {
        throw new Error('PNG tRNS non supportato: trasparenza senza alfa esplicito');
      } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
        throw new Error('APNG animato non supportato');
      } else if (type === 'IDAT') {
        if (idatClosed) throw new Error('Chunk IDAT non consecutivi');
        seenIDAT = true; total += len; idats.push(file.subarray(start, end));
      } else if (type === 'IEND') {
        if (!seenIDAT || len !== 0 || end + 4 !== file.length) throw new Error('IEND PNG non valido o dati dopo IEND');
        ended = true; pos = end + 4; break;
      } else if (!(typeBytes[0] & 32)) {
        throw new Error('Chunk critico PNG non supportato: ' + type);
      }
      pos = end + 4;
    }
    if (!ended || !seenIHDR || !seenIDAT) throw new Error('PNG incompleto: manca IEND o IDAT');
    const compressed = new Uint8Array(total);
    let offset = 0;
    for (const part of idats) { compressed.set(part, offset); offset += part.length; }
    const rowBytes = width * channels, raw = inflateBounded(compressed, (rowBytes + 1) * height);
    const data = new Uint8ClampedArray(width * height * 4);
    let previous = new Uint8Array(rowBytes), current = new Uint8Array(rowBytes), src = 0, dst = 0, transparent = false;
    for (let y = 0; y < height; y++) {
      const filter = raw[src++];
      if (filter > 4) throw new Error('Filtro PNG non valido: ' + filter);
      for (let x = 0; x < rowBytes; x++) {
        const a = x >= channels ? current[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
        const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >>> 1 : paeth(a, b, c);
        current[x] = (raw[src++] + predictor) & 255;
      }
      for (let x = 0; x < rowBytes; x += channels) {
        data[dst++] = current[x]; data[dst++] = current[x + 1]; data[dst++] = current[x + 2];
        const alpha = channels === 4 ? current[x + 3] : 255;
        data[dst++] = alpha; if (alpha !== 255) transparent = true;
      }
      const swap = previous; previous = current; current = swap;
    }
    return { width, height, data, colorType, bitDepth, hasAlpha: colorType === 6, hasTransparency: transparent };
  }
  function chunk(type, data) {
    const out = new Uint8Array(data.length + 12);
    write32(out, 0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8); write32(out, 8 + data.length, crc32(out, 4, 8 + data.length));
    return out;
  }
  function encode(image) {
    if (!image || typeof image !== 'object') throw new Error('Immagine non valida');
    const { width, height, colorType, bitDepth, data, hasAlpha } = image;
    dimensions(width, height);
    if (colorType !== 2 && colorType !== 6) throw new Error('Tipo colore non valido: servono RGB (2) o RGBA (6)');
    if (bitDepth !== undefined && bitDepth !== 8) throw new Error('Profondità non valida: servono 8 bit');
    if (hasAlpha !== undefined && hasAlpha !== (colorType === 6)) throw new Error('Metadato alfa incoerente con il tipo colore');
    if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || data.length !== width * height * 4) throw new Error('Buffer RGBA non valido');
    const channels = colorType === 2 ? 3 : 4, rowBytes = width * channels;
    const raw = new Uint8Array((rowBytes + 1) * height);
    let src = 0, dst = 0;
    for (let y = 0; y < height; y++) {
      raw[dst++] = 0;
      for (let x = 0; x < width; x++) {
        raw[dst++] = data[src++]; raw[dst++] = data[src++]; raw[dst++] = data[src++];
        const alpha = data[src++];
        if (channels === 4) raw[dst++] = alpha;
        else if (alpha !== 255) throw new Error('RGB richiede padding alfa 255');
      }
    }
    const ihdr = new Uint8Array(13); write32(ihdr, 0, width); write32(ihdr, 4, height); ihdr[8] = 8; ihdr[9] = colorType;
    const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', pako.deflate(raw)), chunk('IEND', new Uint8Array(0))];
    const size = parts.reduce((sum, p) => sum + p.length, 0);
    if (size > MAX_FILE_BYTES) throw new Error('PNG codificato oltre il limite di 64 MiB');
    const out = new Uint8Array(size); let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }
  return Object.freeze({ decode, encode });
});
