'use strict';
// Smoke test reale senza dipendenze npm: server loopback e Firefox headless.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
// Firefox installato via Snap usa un /tmp isolato: il profilo deve stare in HOME.
const profile = fs.mkdtempSync(path.join(os.homedir(), 'steganolab-firefox-'));
let browser, timer, finished = false;
const files = {'/vendor/pako-2.1.0.min.js':'vendor/pako-2.1.0.min.js','/png-codec.js':'png-codec.js','/rgba.png':'tests/fixtures/rgba-alpha-imagemagick.png','/rgb.png':'tests/fixtures/rgb-imagemagick.png'};
const page = `<!doctype html><meta charset="utf-8"><script src="/vendor/pako-2.1.0.min.js"></script><script src="/png-codec.js"></script><script>
(async () => {
 try {
  const png = await (await fetch('/rgba.png')).arrayBuffer();
  const expected = [173,135,185,255,173,135,185,128,173,135,185,1,173,135,185,0];
  const image = PngCodec.decode(png), again = PngCodec.decode(PngCodec.encode(image));
  if (image.colorType !== 6 || !image.hasAlpha || !image.hasTransparency || expected.some((x,i) => image.data[i] !== x || again.data[i] !== x)) throw Error('Byte o metadati errati');
  const rgb = PngCodec.decode(await (await fetch('/rgb.png')).arrayBuffer());
  const rgbAgain = PngCodec.decode(PngCodec.encode(rgb));
  const rgbExpected = [1,2,3,255,128,127,254,255,255,0,42,255,17,36,67,255,100,133,166,255,199,232,9,255];
  if (rgb.colorType !== 2 || rgb.hasAlpha || rgb.hasTransparency || rgbExpected.some((x,i) => rgb.data[i] !== x || rgbAgain.data[i] !== x)) throw Error('RGB errato');
  const opaque = PngCodec.decode(PngCodec.encode({width:1,height:1,colorType:6,data:new Uint8ClampedArray([1,2,3,255])}));
  if (!opaque.hasAlpha || opaque.hasTransparency || opaque.colorType !== 6) throw Error('RGBA opaco errato');
  let rejected = false; try {PngCodec.decode(new Uint8Array([0]));} catch (_) {rejected = true;}
  if (!rejected) throw Error('Input non PNG accettato');
  await fetch('/result?ok=1');
 } catch (e) { await fetch('/result?error=' + encodeURIComponent(String(e))); }
})();
</script>`;
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/result') {
    res.end('ok');
    const error = url.searchParams.get('error');
    finish(error ? new Error(error) : null);
  } else if (url.pathname === '/') {
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(page);
  } else if (Object.hasOwn(files,url.pathname)) {
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':'image/png');
    fs.createReadStream(path.join(root,files[url.pathname])).pipe(res);
  } else {res.statusCode=404;res.end();}
});
function finish(error) {
  if (finished) return; finished=true; clearTimeout(timer);
  if (browser) browser.kill();
  server.close(() => {
    try {fs.rmSync(profile,{recursive:true,force:true});} catch (_) { /* Firefox può chiudersi dopo il risultato. */ }
    if (error) {console.error('Firefox smoke test:',error.message);process.exitCode=1;}
    else console.log('Firefox headless: RGB, RGBA, alfa opaco, RGB invisibile ed errore locale superati');
  });
}
server.listen(0,'127.0.0.1',() => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  browser=spawn('firefox',['--headless','--no-remote','--profile',profile,url],{stdio:'ignore'});
  browser.on('error',finish);
  browser.on('exit',code => {if (!finished) finish(new Error('Firefox terminato prima del risultato ('+code+')'));});
  timer=setTimeout(()=>finish(new Error('timeout')),30000);
});
