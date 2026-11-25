'use strict';
// Eseguito dal browser nello stesso origin della UI; solo fixture sintetiche.
(async () => {
  const tests = [], frame = document.getElementById('app');
  let w, d, $;
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const equal = (actual, expected, message) => assert(actual === expected, `${message}: atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`);
  const includes = (actual, expected, message) => assert(actual.includes(expected), `${message}: manca ${JSON.stringify(expected)} in ${JSON.stringify(actual)}`);
  const bytesEqual = (actual, expected, message) => {
    equal(actual.length, expected.length, message + ' lunghezza');
    for (let i = 0; i < expected.length; i++) if (actual[i] !== expected[i]) throw Error(`${message}: byte ${i}, atteso ${expected[i]}, ottenuto ${actual[i]}`);
  };
  const wait = async (fn, message) => {
    const until = performance.now() + 4000;
    while (performance.now() < until) { if (fn()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw Error('Timeout: ' + message);
  };
  async function fresh(width = 1200) {
    frame.style.width = width + 'px';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Timeout caricamento iframe')), 5000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.src = '/deploy/index.html?test=' + Math.random();
    });
    w = frame.contentWindow; d = w.document; $ = id => d.getElementById(id);
    assert($('status'), 'UI non inizializzata');
  }
  const click = id => $(id).click();
  function set(id, value, event = 'input') { $(id).value = String(value); $(id).dispatchEvent(new w.Event(event, {bubbles: true})); }
  function mode(value) { const radio = d.querySelector(`input[name=mode][value=${value}]`); radio.checked = true; radio.dispatchEvent(new w.Event('change', {bubbles: true})); }
  function upload(id, file) { const transfer = new w.DataTransfer(); transfer.items.add(file); $(id).files = transfer.files; $(id).dispatchEvent(new w.Event('change', {bubbles: true})); }
  const file = (name, data) => new w.File([data], name, {type: 'image/png'});
  async function uploaded(id, f, state = id) { upload(id, f); await wait(() => $(state + 'state').textContent.startsWith('Caricato:'), 'upload ' + id + ': ' + f.name); }
  function png(width, height, data, alpha = true) { return w.PngCodec.encode({width, height, colorType: alpha ? 6 : 2, data: new w.Uint8ClampedArray(data)}); }
  function pixels(width, height, alpha = 255) {
    const result = [];
    for (let i = 0; i < width * height; i++) result.push((17 + i * 7) % 256, (84 + i * 9) % 256, (200 - i * 3 + 256) % 256, typeof alpha === 'function' ? alpha(i) : alpha);
    return result;
  }
  async function exported(index, name) {
    const item = w.__downloads[index]; assert(item, 'download non intercettato'); equal(item.name, name, 'nome download'); assert(item.blob instanceof w.Blob, 'Blob mancante'); equal(item.blob.type, 'image/png', 'MIME PNG');
    return {image: w.PngCodec.decode(await item.blob.arrayBuffer()), blob: item.blob};
  }
  async function scenario(name, fn, width) {
    try { await fresh(width); await fn(); await new Promise(resolve => setTimeout(resolve, 30)); equal(w.__uiErrors.join(' | '), '', 'errori console / eccezioni UI'); tests.push({name, ok: true}); }
    catch (e) { tests.push({name, ok: false, error: String(e.message || e)}); }
  }

  await scenario('Avvio, missione iniziale e risorse relative', async () => {
    equal($('status').textContent, 'Missione avviata', 'stato iniziale'); equal($('canvas').width, 32, 'larghezza missione');
    assert(!$('analysis').hidden && $('encoder').hidden, 'scheda iniziale'); includes($('brief').textContent, 'Sella', 'descrizione');
    const links = [...d.querySelectorAll('script[src],link[rel=stylesheet]')].filter(el => !el.getAttribute('src')?.startsWith('/hook'));
    assert(links.length >= 5, 'risorse mancanti');
    for (const el of links) { const raw = el.getAttribute('src') || el.getAttribute('href'); assert(!/^(\/|[a-z]+:)/i.test(raw), 'URL non relativo: ' + raw); }
    const loaded = w.performance.getEntriesByType('resource').map(e => new URL(e.name).pathname);
    for (const path of ['/deploy/style.css', '/deploy/vendor/pako-2.1.0.min.js', '/deploy/png-codec.js', '/deploy/core.js', '/deploy/app.js']) assert(loaded.includes(path), 'risorsa non caricata: ' + path);
    for (const entry of w.performance.getEntriesByType('resource')) equal(new URL(entry.name).origin, location.origin, 'risorsa esterna');
  });

  await scenario('Cambio missione, guida guidata e reset manuale', async () => {
    click('nextstep'); includes($('guide').textContent, '2 / 6', 'passo'); $('notes').value = 'nota'; click('extract');
    set('mission', 3, 'change'); click('load'); equal($('canvas').width, 64, 'missione figura'); includes($('guide').textContent, '1 / 6', 'reset passo'); equal($('notes').value, '', 'reset note'); includes($('bits').textContent, '0 bit', 'reset bit');
    mode('manual'); assert($('missioncontrols').hidden && !$('manualcontrols').hidden, 'controlli manuali'); includes($('stats').textContent, 'Nessun reperto', 'reset immagini');
    mode('mission'); assert(!$('missioncontrols').hidden, 'ritorno missioni'); click('load'); includes($('brief').textContent, 'simbolo', 'missione scelta');
  });

  await scenario('Upload fixture RGB e RGBA indipendenti e selezione A', async () => {
    mode('manual');
    const rgb = await (await fetch('/deploy/tests/fixtures/rgb-imagemagick.png')).arrayBuffer();
    const rgba = await (await fetch('/deploy/tests/fixtures/rgba-alpha-imagemagick.png')).arrayBuffer();
    await uploaded('original', file('rgb.png', rgb)); includes($('originalstate').textContent, 'PNG RGB', 'formato RGB'); assert(![...$('encorder').options].some(o => o.value.includes('A')), 'A disponibile su RGB');
    await uploaded('suspect', file('rgba.png', rgba)); includes($('suspectstate').textContent, 'PNG RGBA', 'formato RGBA'); includes($('suspectstate').textContent, 'trasparenza presente', 'trasparenza');
    assert([...$('order').options].some(o => o.value === 'A'), 'A assente su RGBA'); set('order', 'A'); equal($('order').value, 'A', 'selezione A');
    await uploaded('suspect', file('rgb2.png', rgb)); assert(![...$('order').options].some(o => o.value.includes('A')), 'A rimasto disponibile su RGB'); equal($('order').value, 'RGB', 'fallback da A');
  });

  await scenario('Upload non PNG e recupero dopo errore', async () => {
    mode('manual'); upload('suspect', file('rotto.png', new Uint8Array([0, 1, 2])));
    await wait(() => $('suspectstate').textContent.startsWith('Errore:'), 'rifiuto PNG'); assert($('extract').disabled, 'estrazione abilitata dopo errore');
    await uploaded('suspect', file('valido.png', png(2, 1, pixels(2, 1), false))); assert(!$('extract').disabled, 'upload valido dopo errore');
  });

  await scenario('Race upload: rimozione, sostituzione e cambio modalità', async () => {
    mode('manual'); const originalArrayBuffer = w.File.prototype.arrayBuffer; let release;
    w.File.prototype.arrayBuffer = function () { if (this.name === 'lento.png') return new Promise(resolve => { release = () => originalArrayBuffer.call(this).then(resolve); }); return originalArrayBuffer.call(this); };
    const slow = () => file('lento.png', png(2, 1, pixels(2, 1), false));
    upload('suspect', slow()); assert(release, 'lettura differita non avviata'); click('clearsuspect'); release(); await new Promise(r => setTimeout(r, 50)); includes($('suspectstate').textContent, 'Nessun file', 'rimozione durante upload');
    release = null; upload('suspect', slow()); await uploaded('suspect', file('veloce.png', png(3, 1, pixels(3, 1), false))); release(); await new Promise(r => setTimeout(r, 50)); includes($('suspectstate').textContent, 'veloce.png', 'ultimo upload prevale'); equal($('canvas').width, 3, 'immagine sostituita');
    release = null; upload('suspect', slow()); mode('mission'); click('load'); release(); await new Promise(r => setTimeout(r, 50)); equal($('canvas').width, 32, 'missione non sovrascritta'); includes($('suspectstate').textContent, 'sintetica', 'reperto missione');
  });

  await scenario('RGB invisibili, differenze e raccolta manuale dei bit', async () => {
    mode('manual'); const a = [10, 20, 30, 0, 7, 8, 9, 255], b = [11, 20, 30, 0, 7, 8, 9, 255];
    await uploaded('original', file('a.png', png(2, 1, a))); await uploaded('suspect', file('b.png', png(2, 1, b)));
    set('view', 'diff'); includes($('stats').textContent, '1 pixel alterati', 'diff'); includes($('planeinfo').textContent, '1 pixel alterati coinvolgono', 'avviso trasparenza');
    const row = [...$('pixel').querySelectorAll('tbody tr')][0]; includes(row.textContent, '10 / 00001010', 'RGB originale grezzo'); includes(row.textContent, '11 /', 'RGB sospetto grezzo');
    const bit = row.querySelector('button[title^="Bit 0"]'); assert(bit.classList.contains('changed'), 'bit cambiato non evidenziato'); bit.click(); includes($('bits').textContent, '1 bit raccolti', 'raccolta manuale'); click('undo'); includes($('bits').textContent, '0 bit', 'annulla');
    click('pixelrgb'); includes($('rgbcurrenttext').textContent, 'RGBA (11, 20, 30, 0)', 'esploratore pixel grezzo'); click('closergb');
  });

  await scenario('Sei missioni storiche: estrazione testo e piani immagine dalla UI', async () => {
    const textCases = [
      {mission: 0, order: 'RGB', scan: 'row', bit: 0, text: 'CIAO'},
      {mission: 1, order: 'G', scan: 'row', bit: 0, text: 'FARO'},
      {mission: 2, order: 'B', scan: 'col', bit: 0, text: 'NORD'},
      {mission: 5, order: 'RG', scan: 'row', bit: 2, text: 'TRAC'}
    ];
    for (const test of textCases) {
      set('mission', test.mission, 'change'); click('load');
      equal($('canvas').width, 32, 'larghezza missione ' + test.mission);
      set('order', test.order); set('scan', test.scan); set('extractbit', test.bit); set('count', 32); click('extract');
      includes($('bits').textContent, '32 bit raccolti', 'raccolta missione ' + test.mission);
      const actualBits = [...$('bits').querySelectorAll('.byte')].map(row => [...row.querySelectorAll('span')].map(cell => cell.textContent).join('')).join('');
      const expectedBits = [...new TextEncoder().encode(test.text)].map(byte => byte.toString(2).padStart(8, '0')).join('');
      equal(actualBits, expectedBits, 'bit missione ' + test.mission); click('decode'); equal($('decoded').textContent, test.text, 'decodifica missione ' + test.mission);
    }
    for (const test of [{mission: 3, channel: 'G', bit: 0}, {mission: 4, channel: 'B', bit: 1}]) {
      set('mission', test.mission, 'change'); click('load'); set('view', 'plane'); set('channel', test.channel); set('bit', test.bit);
      assert(!$('saveplane').hidden, 'piano immagine disponibile'); click('saveplane');
      const {image} = await exported(w.__downloads.length - 1, 'piano.png');
      equal(image.width, 64, 'larghezza piano'); equal(image.height, 48, 'altezza piano'); equal(image.colorType, 6, 'formato piano');
      let white = 0;
      for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
        const on = test.mission === 3
          ? ((x - 23) ** 2 + (y - 17) ** 2 < 100 || (x - 41) ** 2 + (y - 17) ** 2 < 100 || (y >= 17 && y < 42 && Math.abs(x - 32) < (42 - y) * 0.85))
          : ((x >= 5 && x <= 53 && Math.abs(y - (39 - x * 0.55 + 4 * Math.sin(x / 5))) < 1.5 && x % 8 < 5) || (x >= 49 && x <= 61 && y >= 4 && y <= 16 && (Math.abs(x - 55 - (y - 10)) < 1.5 || Math.abs(x - 55 + (y - 10)) < 1.5)));
        const value = on ? 255 : 0, i = (y * 64 + x) * 4; if (on) white++;
        for (let c = 0; c < 3; c++) equal(image.data[i + c], value, `piano missione ${test.mission} (${x},${y})`);
        equal(image.data[i + 3], 255, 'piano opaco');
      }
      includes($('planeinfo').textContent, `${white} bit a 1`, 'conteggio piano');
    }
  });

  await scenario('Missione 007, canale A, estrazione e decodifica', async () => {
    set('mission', 6, 'change'); click('load'); includes($('brief').textContent, 'trasparenza', 'missione 007');
    // I buffer canonici, non i pixel Canvas premoltiplicati, sono la fonte di verità.
    const pair = w.eval('({original, suspect})'), a = pair.original, b = pair.suspect;
    equal(a.width, 32, 'larghezza originale'); equal(a.height, 20, 'altezza originale'); equal(b.width, a.width, 'larghezza sospetta'); equal(b.height, a.height, 'altezza sospetta');
    assert(a.hasAlpha && b.hasAlpha && a.colorType === 6 && b.colorType === 6, 'entrambi RGBA');
    const zones = [0, 0, 0], changes = [0, 0, 0], expectedPlane = [];
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4, zone = x < 11 ? 0 : x < 22 ? 1 : 2;
      for (let c = 0; c < 3; c++) equal(b.data[i + c], a.data[i + c], `RGB invariato (${x},${y})`);
      equal(a.data[i + 3], [255, 128, 0][zone], `alfa originale (${x},${y})`); zones[zone]++;
      const delta = Math.abs(b.data[i + 3] - a.data[i + 3]); assert(delta <= 1, `delta alfa ${delta} a (${x},${y})`);
      if (delta) changes[zone]++; const v = ((a.data[i + 3] ^ b.data[i + 3]) & 1) ? 255 : 0; expectedPlane.push(v, v, v, 255);
    }
    for (let i = 0; i < 3; i++) assert(zones[i] > 0 && changes[i] > 0, 'zona alfa non esercitata: ' + i);
    includes($('stats').textContent, `A: ${changes.reduce((sum, n) => sum + n, 0)}`, 'conteggio differenze alfa');
    set('order', 'A'); set('scan', 'row'); set('extractbit', 0); set('count', 32); click('extract'); includes($('bits').textContent, '32 bit raccolti', 'raccolta'); click('decode'); equal($('decoded').textContent, 'LUCE', 'messaggio 007');
    set('view', 'xor'); set('channel', 'A'); set('bit', 0); assert(!$('saveplane').hidden, 'piano A non esportabile'); includes($('planeinfo').textContent, `${changes.reduce((sum, n) => sum + n, 0)} bit modificati`, 'XOR A');
    click('saveplane'); const {image, blob} = await exported(0, 'piano.png'); equal(image.width, 32, 'larghezza PNG'); equal(image.height, 20, 'altezza PNG'); equal(image.colorType, 6, 'PNG RGBA'); bytesEqual(image.data, expectedPlane, 'PNG XOR A');
    mode('manual'); await uploaded('suspect', file('piano-007.png', blob)); includes($('suspectstate').textContent, 'PNG RGBA', 'ricarica PNG');
  });

  await scenario('Confronto RGB e RGBA misti: XOR A escluso in entrambi i versi', async () => {
    mode('manual'); const rgb = [10,20,30,255, 40,50,60,255], rgba = [11,20,30,0, 40,50,60,128];
    for (const swap of [false, true]) {
      await uploaded('original', file('original.png', png(2, 1, swap ? rgba : rgb, swap)));
      await uploaded('suspect', file('suspect.png', png(2, 1, swap ? rgb : rgba, !swap)));
      includes($('stats').textContent, '1 pixel alterati', 'confronto solo RGB'); includes($('stats').textContent, 'XOR A non disponibile', 'avviso formati misti');
      set('view', 'xor'); assert(![...$('channel').options].some(o => o.value === 'A'), 'XOR A disponibile con RGB');
      set('channel', 'R'); set('bit', 0); click('saveplane'); const {image} = await exported(w.__downloads.length - 1, 'piano.png'); bytesEqual(image.data, [255,255,255,255,0,0,0,255], 'XOR RGB misto');
      set('view', 'plane'); equal([...$('channel').options].some(o => o.value === 'A'), !swap, 'A su piano sospetta');
      equal([...$('order').options].some(o => o.value === 'A'), !swap, 'A su estrazione sospetta');
    }
  });

  await scenario('RGBA totalmente opaca: A disponibile e PNG nativo', async () => {
    mode('manual'); const data = pixels(8, 1); await uploaded('original', file('opaca.png', png(8, 1, data)));
    includes($('originalstate').textContent, 'PNG RGBA', 'formato opaco'); includes($('originalstate').textContent, 'nessuna trasparenza effettiva', 'alfa opaco');
    assert([...$('encorder').options].some(o => o.value === 'A'), 'encoder A assente su RGBA opaca');
    click('tab-encoder'); set('encorder', 'A'); set('encbit', 0); set('message', 'A'); click('encode');
    const {image, blob} = await exported(0, 'reperto.png'); equal(image.colorType, 6, 'export mantiene RGBA');
    const expected = data.slice(); for (let i = 0; i < 8; i++) expected[i * 4 + 3] = 254 | Number('01000001'[i]); bytesEqual(image.data, expected, 'byte RGBA opaca');
    click('analysecreated'); set('view', 'xor'); set('channel', 'A'); includes($('planeinfo').textContent, '6 bit modificati', 'XOR alfa');
    await uploaded('suspect', file('opaca-ricaricata.png', blob)); set('order', 'A'); set('scan', 'row'); set('extractbit', 0); set('count', 8); click('extract'); click('decode'); equal($('decoded').textContent, 'A', 'estrazione RGBA ricaricata');
  });

  await scenario('Encoder testo UTF-8 su A, export e ricarica PNG', async () => {
    click('tab-encoder'); const data = pixels(8, 2, i => [0, 128, 255, 1][i % 4]); await uploaded('coverfile', file('cover.png', png(8, 2, data)), 'cover');
    set('encorder', 'A'); set('encbit', 0); set('message', 'é'); includes($('capacity').textContent, '16 bit · 2 byte', 'capacità UTF-8'); click('encode');
    const {image, blob} = await exported(0, 'reperto.png'); equal(image.colorType, 6, 'export RGBA'); const expected = data.slice(), bits = '1100001110101001'; for (let i = 0; i < 16; i++) expected[i * 4 + 3] = (expected[i * 4 + 3] & 254) | Number(bits[i]); bytesEqual(image.data, expected, 'byte testo');
    click('analysecreated'); equal($('tab-analysis').getAttribute('aria-selected'), 'true', 'ritorno analisi'); set('order', 'A'); set('count', 16); click('extract'); click('decode'); equal($('decoded').textContent, 'é', 'testo creato');
    click('clearsuspect'); await uploaded('suspect', file('ricaricato.png', blob)); set('order', 'A'); set('count', 16); click('extract'); click('decode'); equal($('decoded').textContent, 'é', 'testo ricaricato');
    set('x', 4); set('y', 0); click('inspect'); const rows = $('pixel').querySelectorAll('tbody tr'); includes(rows[0].cells[2].textContent, '45 /', 'RGB grezzo dopo reload'); includes(rows[3].cells[2].textContent, '0 /', 'pixel trasparente dopo reload');
  });

  await scenario('Encoder testo RGB, capacità e formato nativo', async () => {
    click('tab-encoder'); const data = pixels(8, 1); await uploaded('coverfile', file('rgb.png', png(8, 1, data, false)), 'cover'); set('encorder', 'R'); set('message', 'AB'); click('encode'); includes($('encstatus').textContent, 'troppo lungo', 'errore capacità'); equal(w.__downloads.length, 0, 'download oltre capacità');
    set('message', 'A'); click('encode'); const {image, blob} = await exported(0, 'reperto.png'); equal(image.colorType, 2, 'export RGB'); const expected = data.slice(); for (let i = 0; i < 8; i++) expected[i * 4] = (expected[i * 4] & 254) | Number('01000001'[i]); bytesEqual(image.data, expected, 'byte RGB');
    const bitmap = await w.createImageBitmap(blob, {colorSpaceConversion:'none'}); const nativeCanvas = d.createElement('canvas'); nativeCanvas.width = 8; nativeCanvas.height = 1; const ctx = nativeCanvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bytesEqual(ctx.getImageData(0, 0, 8, 1).data, expected, 'decoder PNG nativo'); bitmap.close();
  });

  await scenario('Maschera RGBA trasparente: soglia RGB e export', async () => {
    click('tab-encoder'); const cover = pixels(2, 2, i => [0, 128, 255, 1][i]);
    const mask = [128,128,128,0, 127,128,128,255, 255,255,255,0, 0,0,0,255];
    await uploaded('coverfile', file('cover.png', png(2, 2, cover)), 'cover'); await uploaded('maskfile', file('mask.png', png(2, 2, mask)), 'mask'); set('maskchannel', 'A'); set('maskbit', 1); click('hidemask');
    const {image} = await exported(0, 'reperto-immagine.png'); const expected = cover.slice(); for (let i = 0; i < 4; i++) expected[4*i+3] = (expected[4*i+3] & ~2) | ([1,0,1,0][i] << 1); bytesEqual(image.data, expected, 'maschera');
    await uploaded('maskfile', file('small.png', png(1, 1, [0,0,0,255])), 'mask'); click('hidemask'); includes($('encstatus').textContent, 'stesse dimensioni', 'dimensioni maschera'); equal(w.__downloads.length, 1, 'download maschera incompatibile');
  });

  await scenario('Piano XOR esportato, pixel opachi e reload', async () => {
    mode('manual'); const a = [10,20,30,0, 8,9,10,128], b = [11,20,30,0, 8,9,10,128]; await uploaded('original', file('a.png', png(2,1,a))); await uploaded('suspect', file('b.png', png(2,1,b)));
    set('view', 'xor'); set('channel', 'R'); set('bit', 0); click('saveplane'); const {image, blob} = await exported(0, 'piano.png'); bytesEqual(image.data, [255,255,255,255,0,0,0,255], 'piano XOR');
    await uploaded('suspect', file('piano.png', blob)); equal($('canvas').width, 2, 'reload piano'); includes($('suspectstate').textContent, 'RGBA', 'formato piano');
  });

  await scenario('Zoom, click geometrico, frecce e griglia', async () => {
    set('zoom', Math.log(10)); assert($('canvas').parentElement.classList.contains('gridded'), 'griglia a zoom elevato'); const r = $('canvas').getBoundingClientRect();
    $('canvas').dispatchEvent(new w.MouseEvent('click', {bubbles:true, clientX:r.left + 2.5 * r.width / $('canvas').width, clientY:r.top + 3.5 * r.height / $('canvas').height})); equal($('x').value, '2', 'click X'); equal($('y').value, '3', 'click Y');
    $('canvas').dispatchEvent(new w.KeyboardEvent('keydown', {bubbles:true, key:'ArrowRight'})); equal($('x').value, '3', 'freccia destra'); $('canvas').dispatchEvent(new w.KeyboardEvent('keydown', {bubbles:true, key:'ArrowUp'})); equal($('y').value, '2', 'freccia su');
    $('grid').checked = false; $('grid').dispatchEvent(new w.Event('input', {bubbles:true})); assert(!$('canvas').parentElement.classList.contains('gridded'), 'griglia disattivata'); click('fit'); assert(parseFloat($('zoomvalue').textContent) > 0, 'zoom adatta');
  });

  await scenario('Zoom frazionario, click ai bordi e resize manuale/automatico', async () => {
    set('zoom', Math.log(3.375)); const canvas = $('canvas'), reference = $('reference');
    const scale = parseFloat(canvas.style.width) / canvas.width;
    assert(scale > 3 && scale < 4 && Math.abs(scale - Math.round(scale)) > 0.1, 'zoom non frazionario');
    function selectPixel(element, x, y, fx, fy) {
      const r = element.getBoundingClientRect();
      element.dispatchEvent(new w.MouseEvent('click', {bubbles:true, clientX:r.left + (x + fx) * r.width / element.width, clientY:r.top + (y + fy) * r.height / element.height}));
      equal($('x').value, String(x), 'click X'); equal($('y').value, String(y), 'click Y');
      for (const c of [canvas, reference]) {
        const marker = c.parentElement.querySelector('.marker');
        assert(Math.abs(parseFloat(marker.style.left) - x * scale) < 0.01, 'marker X'); assert(Math.abs(parseFloat(marker.style.top) - y * scale) < 0.01, 'marker Y');
      }
    }
    selectPixel(canvas, 0, 0, 0.4, 0.4); selectPixel(canvas, 31, 19, 0.6, 0.6); selectPixel(reference, 7, 8, 0.5, 0.5);
    const manualWidth = parseFloat(canvas.style.width); frame.style.width = '700px'; await wait(() => w.innerWidth === 700, 'resize manuale');
    await new Promise(resolve => setTimeout(resolve, 50)); equal(parseFloat(canvas.style.width), manualWidth, 'zoom manuale preservato'); selectPixel(canvas, 12, 4, 0.5, 0.5);
    click('fit'); const fitWidth = parseFloat(canvas.style.width); frame.style.width = '375px';
    await wait(() => w.innerWidth === 375 && parseFloat(canvas.style.width) < fitWidth, 'resize con adatta');
    const fitted = canvas.getBoundingClientRect(); canvas.dispatchEvent(new w.MouseEvent('click', {bubbles:true, clientX:fitted.left + 15.5 * fitted.width / canvas.width, clientY:fitted.top + 10.5 * fitted.height / canvas.height}));
    equal($('x').value, '15', 'click dopo resize X'); equal($('y').value, '10', 'click dopo resize Y');
  });

  await scenario('Tabella ASCII, ricerca e chiusura', async () => {
    click('openascii'); assert($('asciidialog').open, 'dialog ASCII aperto'); equal($('ascii').rows.length, 128, 'numero righe');
    set('asciisearch', '0x41'); equal($('ascii').rows.length, 1, 'filtro esadecimale'); includes($('ascii').textContent, '01000001', 'binario A');
    set('asciisearch', '65'); equal($('ascii').rows.length, 1, 'filtro decimale'); click('closeascii'); assert(!$('asciidialog').open, 'dialog chiuso'); click('asciinear'); equal($('asciisearch').value, '', 'reset ricerca'); click('closeascii');
  });

  await scenario('Esploratore RGBA: bit, riferimento e indipendenza', async () => {
    const before = $('pixel').textContent; click('openrgb'); assert($('rgbdialog').open, 'dialog RGBA');
    const alpha = $('rgbcontrols').querySelectorAll('.rgbrow')[3], input = alpha.querySelector('input[type=number]'); input.value = '0'; input.dispatchEvent(new w.Event('change', {bubbles:true})); includes($('rgbcurrenttext').textContent, '128, 128, 128, 0', 'alfa cambiato');
    alpha.querySelector('button[title^="Bit 0"]').click(); includes($('rgbcurrenttext').textContent, '128, 128, 128, 1', 'bit alfa'); click('rgbpin'); alpha.querySelector('button[title^="Bit 7"]').click(); click('rgbreset'); includes($('rgbcurrenttext').textContent, '128, 128, 128, 1', 'ripristino'); click('closergb'); equal($('pixel').textContent, before, 'pixel non modificato');
  });

  await scenario('Reload completo ripristina la missione iniziale', async () => {
    mode('manual'); await uploaded('suspect', file('temp.png', png(2,1,pixels(2,1),false))); $('notes').value = 'temporanea'; await fresh(); includes($('brief').textContent, 'Sella', 'missione iniziale'); equal($('notes').value, '', 'note non persistite'); equal($('canvas').width, 32, 'dimensioni iniziali');
  });

  await scenario('Responsive a 375px: colonne, dialog e overflow', async () => {
    equal(w.getComputedStyle($('analysis')).gridTemplateColumns.split(' ').length, 1, 'colonna analisi'); equal(w.getComputedStyle(d.querySelector('.comparison')).gridTemplateColumns.split(' ').length, 1, 'colonna confronto');
    assert(d.documentElement.scrollWidth <= w.innerWidth, `overflow orizzontale: ${d.documentElement.scrollWidth} > ${w.innerWidth}`); click('openrgb'); assert($('rgbdialog').getBoundingClientRect().width <= w.innerWidth, 'dialog fuori viewport'); click('closergb'); click('tab-encoder'); equal(w.getComputedStyle($('encoder')).gridTemplateColumns.split(' ').length, 1, 'colonna encoder');
  }, 375);

  await scenario('Guida: apertura browser e collegamenti relativi', async () => {
    const a = [...d.querySelectorAll('a')].find(el => el.textContent.includes('Guida all’uso')); equal(a.getAttribute('href'), 'guide.html', 'link guida relativo'); equal(new URL(a.href).pathname, '/deploy/guide.html', 'risoluzione guida');
    const url = a.href; await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Timeout guida')), 5000); frame.onload = () => { clearTimeout(timer); resolve(); }; frame.src = url; });
    w = frame.contentWindow; d = w.document; $ = id => d.getElementById(id); assert($('analisi') && $('encoder'), 'sezioni guida'); equal(d.title, 'Guida SteganoLab', 'titolo guida'); equal(d.querySelector('header a').getAttribute('href'), 'index.html', 'ritorno relativo');
    assert(w.performance.getEntriesByType('resource').some(e => new URL(e.name).pathname === '/deploy/style.css'), 'CSS guida non caricato');
  });

  await scenario('Guida: RGBA e missione 007 documentati come disponibili', async () => {
    const html = await (await fetch('/deploy/guide.html')).text(); const text = new DOMParser().parseFromString(html, 'text/html').body.textContent;
    assert(!text.includes('sono previsti, non confermati'), 'la guida dichiara RGBA e missione 007 non disponibili, ma sono presenti nella UI');
  });

  await scenario('Guida: descrizione corretta di acquisizione ed export', async () => {
    const html = await (await fetch('/deploy/guide.html')).text(); const text = new DOMParser().parseFromString(html, 'text/html').body.textContent;
    assert(!text.includes('Acquisizione ed esportazione usano Canvas'), 'la guida dichiara acquisizione ed export Canvas, ma la UI usa il codec PNG');
  });

  const requests = ['/deploy/style.css', '/deploy/vendor/pako-2.1.0.min.js', '/deploy/png-codec.js', '/deploy/core.js', '/deploy/app.js'];
  await fetch('/results', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tests, browser:navigator.userAgent, requests})});
})().catch(error => fetch('/results', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tests:[{name:'Harness', ok:false, error:String(error.stack || error)}], browser:navigator.userAgent})}));