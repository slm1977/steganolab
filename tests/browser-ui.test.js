'use strict';
// Test UI reali, senza pacchetti npm: node tests/browser-ui.test.js
// BROWSER può indicare il percorso di Chrome/Chromium. Non usare dati personali.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'steganolab-ui-'));
const browserPath = process.env.BROWSER || 'google-chrome';
const requests = [];
let browser, timer, finished = false, stderr = '';
const types = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.md': 'text/plain; charset=utf-8'};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  requests.push(`${req.method} ${url.pathname}`);
  if (req.method === 'POST' && url.pathname === '/results') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.end('OK');
      try {
        const result = JSON.parse(body);
        for (const test of result.tests) console.log(`${test.ok ? 'PASS' : 'FAIL'} ${test.name}${test.error ? '\n  ' + test.error : ''}`);
        const failed = result.tests.filter(test => !test.ok).length;
        console.log(`\n${result.tests.length - failed}/${result.tests.length} test superati; ${failed} falliti. Browser: ${result.browser}`);
        if (result.requests) console.log('Risorse relative caricate: ' + result.requests.join(', '));
        finish(failed ? 1 : 0);
      } catch (e) { console.error('Risultato non valido:', e); finish(1); }
    });
    return;
  }
  if (url.pathname === '/harness') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><meta charset="utf-8"><title>UI test</title><iframe id="app" style="width:1200px;height:900px;border:0"></iframe><script src="/harness.js"></script>');
    return;
  }
  if (url.pathname === '/harness.js') return serve(path.join(root, 'tests/browser-ui.harness.js'), res);
  if (url.pathname === '/hook.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`window.__uiErrors=[]; window.addEventListener('error',e=>__uiErrors.push('error: '+(e.message||e.target?.src||e.target?.href||'risorsa')),true); window.addEventListener('unhandledrejection',e=>__uiErrors.push('unhandledrejection: '+String(e.reason))); const originalConsoleError=console.error; console.error=(...args)=>{__uiErrors.push('console.error: '+args.join(' '));originalConsoleError.apply(console,args)}; window.__downloads=[]; const urls=new Map(); const create=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{const url=create(blob);urls.set(url,blob);return url}; HTMLAnchorElement.prototype.click=function(){if(this.download){__downloads.push({name:this.download,blob:urls.get(this.href)});return} return HTMLElement.prototype.click.call(this)};`);
    return;
  }
  if (!url.pathname.startsWith('/deploy/')) { res.writeHead(404); res.end(); return; }
  let relative;
  try { relative = decodeURIComponent(url.pathname.slice('/deploy/'.length)); } catch (_) { res.writeHead(400); res.end(); return; }
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  if (relative === 'index.html' || relative === 'guide.html') {
    // Installazione delle sonde prima degli script, senza modificare il file reale.
    fs.readFile(filename, 'utf8', (err, html) => {
      if (err) { res.writeHead(500); res.end(String(err)); return; }
      res.setHeader('Content-Type', types['.html']);
      res.end(html.replace('<head>', '<head><script src="/hook.js"></script>'));
    });
  } else serve(filename, res);
});

function serve(filename, res) {
  fs.readFile(filename, (err, contents) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    res.end(contents);
  });
}
function finish(code) {
  if (finished) return;
  finished = true; clearTimeout(timer);
  if (browser) browser.kill();
  server.close(() => {
    try { fs.rmSync(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 100}); } catch (_) { /* browser in chiusura */ }
    process.exitCode = code;
  });
}
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/harness`;
  browser = spawn(browserPath, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-default-browser-check', `--user-data-dir=${profile}`, url], {stdio: ['ignore', 'ignore', 'pipe']});
  browser.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-6000); });
  browser.on('error', e => { console.error('Avvio browser fallito:', e.message); finish(1); });
  browser.on('exit', code => { if (!finished) { console.error('Browser terminato prima dei risultati:', code, stderr); finish(1); } });
  timer = setTimeout(() => { console.error('Timeout browser; richieste:', requests.join(', '), '\n', stderr); finish(1); }, 60000);
});