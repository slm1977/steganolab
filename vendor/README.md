# Codec PNG integrato e dipendenza vendorizzata

## Dipendenza

- Pako **2.1.0**, commit `3c06216518c259b569a5168dee867e6dabbe5160`, <https://github.com/nodeca/pako/tree/3c06216518c259b569a5168dee867e6dabbe5160>.
- `pako-2.1.0.min.js` è il file upstream `dist/pako.min.js`, non modificato, SHA-256 `ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907`.
- `PAKO-LICENSE` è la licenza MIT upstream, SHA-256 `a04665b3b2de56c66730c1f720f528175739e4104f79073614aa611da1e85539`.
- Per aggiornare: scegliere versione/commit immutabile, recuperare dal repository ufficiale `dist/pako.min.js` e `LICENSE`, verificare checksum, licenza e API, aggiornare i riferimenti e ripetere tutti i test; non caricare da CDN durante l'uso.

UPNG.js è stato valutato ma non è utilizzato: la validazione stretta dei chunk e la decompressione con limite effettivo richiederebbero comunque un wrapper; il codec implementa direttamente parsing, filtri ed encoder PNG ed usa Pako solo per DEFLATE. Niente quantizzazione, palette o Canvas.

## API sincrona

Node: `const PngCodec = require('./png-codec.js')`. Nel browser caricare prima `vendor/pako-2.1.0.min.js`, poi `png-codec.js`: entrambi sono file locali; l'API è `globalThis.PngCodec`.

- `decode(arrayBuffer)` accetta anche `Uint8Array`/`Uint8ClampedArray`, incluse viste con offset. Restituisce `{width, height, data, colorType, bitDepth, hasAlpha, hasTransparency}`. `data` è `Uint8ClampedArray` RGBA, byte grezzi non premoltiplicati. Per RGB, A=255 è solo padding. Per RGBA tutti i byte sono conservati, anche sotto A=0. `hasAlpha` indica la presenza del canale, `hasTransparency` almeno un alfa diverso da 255.
- `encode({width,height,data,colorType,bitDepth?,hasAlpha?})` restituisce `Uint8Array`. `colorType` obbligatorio 2 oppure 6, `data` è un array di byte RGBA con esattamente quattro byte per pixel; RGB richiede padding A=255, per evitare perdita silenziosa. `bitDepth`, se fornito, deve essere 8; `hasAlpha`, se fornito, deve corrispondere al tipo colore. Non modifica `data`. L'output è RGB packed (3 byte/pixel) oppure RGBA, 8 bit, filtro 0, statico.

## Politica di sicurezza e limiti

Firma, dimensioni (massimo 4.000.000 pixel), tipo/profondità, struttura, ordine e CRC di tutti i chunk sono verificati prima di decomprimere; file massimo 64 MiB e massimo 100.000 chunk. Rifiutati APNG, tRNS, Adam7, tipi diversi da RGB 2/RGBA 6, profondità diverse da 8, chunk critici sconosciuti, IDAT non consecutivi, dati dopo IEND e chunk malformati. PLTE opzionale è ammesso solo con lunghezza e posizione corrette; non viene usato per convertire i pixel.

Sono validati header zlib, stream DEFLATE, esatta lunghezza e Adler-32; non si accettano flussi concatenati o byte extra. L'output della decompressione è limitato a `(width * canali + 1) * height` byte (massimo 20.000.000 byte con 4 milioni di pixel), più un blocco temporaneo di massimo 64 KiB. I cinque filtri PNG sono gestiti. Nessuna conversione gamma/ICC: un'anteprima può apparire diversa da un visualizzatore con gestione colore. I metadati accessori sono ignorati e non conservati nell'output; la loro semantica interna non è validata, ma lunghezza, CRC e struttura complessiva sì. Non è un validatore completo di tutti i metadati PNG.

Il codec è integrato nell'interfaccia: caricamento, analisi ed esportazione dei reperti usano il buffer grezzo, mentre Canvas serve solo per le anteprime. I piani sono esportati dal loro buffer opaco. Il codec preserva i pixel e il tipo RGB/RGBA, non i byte dell'intero file PNG né i metadati accessori.

## Verifiche

- `node tests/png-codec.test.js`: richiede Node e ImageMagick `convert` nel PATH come decoder indipendente. I test usano anche zlib di Node e fixture ImageMagick.
- `node tests/fixtures/browser-smoke.js`: richiede Firefox nel PATH e le fixture PNG; avvia un server loopback e un profilo temporanei. Smoke test limitato al codec, non alla UI.
- `node tests/browser-ui.test.js`: richiede Google Chrome nel PATH e le fixture PNG; `BROWSER` può indicare un eseguibile Chrome/Chromium compatibile. Avvia un server loopback e un profilo temporanei e verifica scenari dell'interfaccia, compresi upload, esportazione e ricarica.
- `node tests/core.test.js`: regressione separata del core. Nessuno di questi test richiede pacchetti npm.

Verificare inoltre manualmente nel browser caricamento ed esportazione, ricarica e ispezione dei pixel, inclusi quelli trasparenti: gli scenari automatici non sostituiscono la verifica manuale.

Le fixture sono state create con ImageMagick 6.9.11-60 Q16 con ingresso raw a 8 bit e opzioni `-define png:color-type=6` o `2` e `-define png:bit-depth=8`. `rgba-alpha-imagemagick.png` usa quattro pixel RGB `(173,135,185)` con A `255,128,1,0`. `rgb-imagemagick.png` ha dimensioni 3×2; i byte esatti sono elencati nel test. I file possono contenere metadati accessori di ImageMagick, che non sono necessari ai test di integrità.
