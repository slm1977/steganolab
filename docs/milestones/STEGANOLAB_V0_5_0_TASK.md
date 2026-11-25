# SteganoLab v0.5.0 — Supporto PNG RGB/RGBA e integrità binaria

## 1. Contesto e obiettivo

Repository: `slm1977/steganolab`. Baseline attesa: v0.4.2. SteganoLab è un laboratorio didattico di steganografia per studenti di liceo, anche senza conoscenze di programmazione. È una web app HTML/CSS/JavaScript eseguita localmente nel browser e pubblicata tramite GitHub Pages.

Obiettivo: supportare PNG RGB e RGBA native a 8 bit per canale, senza perdita involontaria dei valori dei pixel, migliorare il caricamento dei reperti e introdurre l'analisi didattica del canale alfa.

## 2. Procedura operativa per l'agente

1. Leggere README, eventuale AGENTS.md, changelog, documentazione tecnica e didattica, HTML, CSS, JavaScript, test e configurazione GitHub Pages. Verificare branch, stato Git e versione effettiva. Non sovrascrivere modifiche dell'utente.
2. Ricostruire il flusso di caricamento, rendering, analisi, estrazione, encoder, missioni ed esportazione. Individuare tutti i punti in cui Canvas è usato come sorgente di dati o per esportare PNG.
3. Presentare un piano con file interessati, librerie, rischi, compatibilità e strategia di test. Attendere l'autorizzazione dell'utente prima di modificare il codice.
4. Implementare per milestone, eseguendo test a ogni passaggio. Non introdurre React, backend, servizi a pagamento o dipendenze runtime da CDN.
5. Presentare risultati e limiti; non effettuare push o pubblicazione senza esplicita autorizzazione. Non dichiarare superati test non eseguiti.

I nomi di file e funzioni citati sono indicativi: verificare quelli effettivi nel repository.

## 3. M1 — Codec PNG lossless

### 3.1 Dipendenze

Valutare UPNG.js e Pako 2.1.0 (o altra versione compatibile motivata). Usare UPNG.decode/toRGBA8 e UPNG.encodeLL, previa verifica delle API e dei test. Non utilizzare encoder con quantizzazione, ottimizzazione lossy o conversione automatica a palette. Integrare localmente in `vendor/`, fissando versione o commit esatto, provenienza, licenze e istruzioni di aggiornamento. Verificare che eventuali file vendor parziali siano integri. Nessuna richiesta a CDN durante l'utilizzo.

### 3.2 Validazione e metadati

Prima della decompressione verificare firma PNG, IHDR, dimensioni positive, limite di 4 milioni di pixel, profondità, tipo colore e struttura dei chunk; applicare limiti ragionevoli a dimensione file e dati decompressi, gestire file corrotti e input non PNG. Non fidarsi dell'estensione. Rifiutare APNG e formati non supportati con messaggio esplicito. Verificare CRC e lunghezze o documentare e mitigare eventuali limiti del codec.

Supporto nativo obbligatorio: color type 2 (RGB) e 6 (RGBA), depth 8, PNG statiche. Gestire interlacciamento Adam7 se supportato e testato; altrimenti rifiutarlo esplicitamente. Riconoscere grayscale (0), palette (3), grayscale+alpha (4), profondità diverse da 8 e trasparenza tRNS; non convertirli silenziosamente. Per RGB con tRNS, in questa versione mostrare il formato e rifiutare con spiegazione (trasparenza senza alfa esplicito). Non confondere RGBA interamente opaca con RGB.

### 3.3 Modello dati

Introdurre un modulo codec dedicato, ad esempio `png-codec.js`. Rappresentare ogni reperto con width, height, data RGBA a 8 bit non premoltiplicati, colorType, bitDepth, hasAlpha, nome e metadati necessari. Per RGB usare A=255 soltanto come padding interno, mai come canale steganografico disponibile. Per RGBA preservare tutti i quattro byte, anche quando A=0. Non applicare conversioni gamma/ICC ai dati steganografici. Documentare che l'anteprima può differire dalla resa di un visualizzatore con gestione colore e che i metadati accessori possono non essere conservati.

### 3.4 Separazione dati/rendering

Il buffer canonico è l'unica sorgente per microscopio, XOR, piani, estrazione, codifica e download. Canvas serve esclusivamente alla visualizzazione; vietato usare drawImage/getImageData per acquisire i dati steganografici o canvas.toBlob/toDataURL per esportare reperti. Anche i piani esportati devono essere generati dal buffer del piano, non dalla vista grafica. Zoom, griglia, marker e compositing non modificano il buffer.

Esportare RGB come color type 2 e RGBA come color type 6, depth 8, usando il codec lossless. Per encodeLL predisporre buffer RGB packed (3 byte/pixel) oppure RGBA (4 byte/pixel) e parametri cc=3, ac=0/1, depth=8; verificare firma effettiva della versione scelta. Non passare il buffer RGBA direttamente all'encoder RGB. Conservare il formato nativo della copertura anche se tutti gli alfa sono 255. Verificare rileggendo i byte esportati.

## 4. M2 — Caricamento manuale e missioni

Separare esplicitamente le modalità Missioni e Caricamento manuale nella scheda Steganalizzare. Il passaggio al manuale elimina i reperti sintetici, la selezione, i bit raccolti, le statistiche e le informazioni della missione precedente. Non mostrare immagini fantasma. Consentire analisi della sola sospetta o del solo originale quando sensato; disabilitare confronti senza coppia valida.

Per ogni selettore (originale, sospetta, copertura, maschera) mostrare immediatamente stato di caricamento, successo o errore, nome, dimensioni, tipo PNG nativo, profondità, presenza di alfa e bit/pixel. Esempi: PNG RGB, 8 bit/canale, 24 bit/pixel, 24 piani; PNG RGBA, 8 bit/canale, 32 bit/pixel, 32 piani. Distinguere alfa presente da trasparenza effettiva. Per file rifiutati non mostrare successo né mantenere ambiguamente il reperto precedente. Gestire annullamento, riselezione dello stesso file e caricamenti asincroni concorrenti (ultimo caricamento valido richiesto prevale).

Adattare automaticamente lo zoom al viewport e alle dimensioni; consentire zoom manuale anche per fotografie grandi, con fit inferiore a 1 se necessario. Verificare coordinate del click e marker con scala frazionaria, scrolling e resize. Griglia solo quando i pixel sono distinguibili; mantenere checkbox accanto allo slider. Preservare navigazione con frecce, clamp ai bordi e scorrimento automatico; non intercettare frecce nei campi input.

## 5. M3 — Motore steganografico RGBA

Estendere il mapping dei canali R/G/B/A e i validatori del core. Conservare la semantica delle missioni e del protocollo esistente: verificare ordine dei bit, scansione, lunghezza esplicita e assenza/presenza di header nel codice; non introdurre un nuovo protocollo incompatibile. Supportare selezioni di canali ordinate, senza duplicati, con A solo per RGBA. Conservare i preset esistenti e aggiungere A e RGBA; eventuali altri preset devono essere coerenti con il formato.

- Microscopio: mostrare 3 o 4 canali reali, valori decimali, 8 bit, potenze di 2, evidenziazione dei bit alterati e raccolta manuale dalla sospetta. A non deve comparire come canale reale per RGB.
- Piani: 24 per RGB, 32 per RGBA. Bianco=1, nero=0. Piano A visualizzato opaco in bianco e nero, indipendentemente dall'alfa del reperto.
- XOR: bianco=bit cambiato, nero=invariato. Richiedere dimensioni uguali; per coppie RGB/RGBA confrontare solo RGB, indicare che i formati differiscono e disabilitare XOR su A. Non interpretare il padding come alfa reale.
- Mappa differenze: includere alterazioni alfa nelle coppie RGBA; mostrare anche conteggi per canale e pixel alterati. Evidenziare variazioni invisibili nei pixel trasparenti.
- Estrazione: canali, bit e scansione indipendenti dalla visualizzazione; aggiornare capacità e validazione in base ai canali reali. Leggere anche bit invariati e pixel trasparenti. Conservare UTF-8 e raccolta manuale.
- Encoder testo: modificare soltanto il bit scelto dei canali selezionati. Preservare tutti gli altri bit, inclusi RGB con A=0. Validare capacità in bit e byte, considerando la codifica UTF-8 e il protocollo effettivo.
- Encoder immagine monocromatica: mantenere dimensioni uguali e soglia esistente, documentare trattamento dell'alfa della maschera (proposta: soglia sui valori RGB grezzi, ignorando A). Permettere A solo se la copertura è RGBA. Nessuna modifica involontaria agli altri canali.
- Non promuovere automaticamente RGB a RGBA per usare A; mostrare un messaggio chiaro. Per RGB l'encoder non deve esporre A.

## 6. M4 — Interfaccia e strumenti didattici

Mantenere le due schede Steganalizzare e Steganografare, lo stato condiviso dei reperti, la tabella ASCII ricercabile e la guida HTML. Conservare le impostazioni indipendenti di visualizzazione, estrazione ed encoder. Aggiornare i controlli al cambio del formato, ripristinando selezioni non più valide e informando lo studente.

Usare sfondo a scacchiera nelle anteprime dei reperti trasparenti. Il marker, la griglia e la mappa delle differenze devono rimanere leggibili anche con A=0.

### Esploratore colori RGBA

Estendere l'esploratore RGB esistente con un quarto slider A (0–255), input numerico, 8 bit cliccabili, potenze di 2 sopra tutti i bit, evidenziazione dei pesi attivi e somma dinamica. Conservare confronto riferimento/corrente, evidenziazione delle differenze, palette e ripristino. Mostrare RGBA, esadecimale #RRGGBBAA e percentuale di opacità. Usare campioni con scacchiera e overlay separato per il colore. La palette RGB imposta A=255. Importando un pixel RGB indicare alfa assente (opacità implicita 255); l'esploratore può comunque simulare A senza modificare i reperti. Importando RGBA leggere i valori esatti, anche invisibili. Nessuna modifica ai dati reali dall'esploratore.

### Missione 007 — Il segreto della trasparenza

Creare una nuova missione sintetica RGBA con messaggio UTF-8 nascosto esclusivamente nel bit 0 di A. Proposta: copertura con zone opache, semitrasparenti e trasparenti; usare il protocollo testuale esistente e fornire un indizio sulla lunghezza, senza svelare il canale. Obiettivo: individuare le alterazioni tramite XOR, scegliere canale/bit/scansione, raccogliere e decodificare il messaggio. Verificare che RGB resti identico e che l'alterazione alfa sia al massimo 1. Conservare tutte le sei missioni precedenti. Non inserire la soluzione nella guida studente.

## 7. M5 — Test obbligatori e criteri di accettazione

Usare il runner già presente o introdurre test Node semplici e riproducibili. Aggiungere fixture PNG indipendenti dal codec testato, generate ad esempio con Python/Pillow o un altro encoder verificato; non affidarsi esclusivamente al round-trip della stessa libreria. Documentare i comandi. Non richiedere Python agli studenti.

### Integrità codec

- Fixture RGBA con pixel (173,135,185,255), (173,135,185,128), (173,135,185,1), (173,135,185,0). Verificare tutti i byte dopo decode, encode e decode, inclusi RGB invisibili.
- Test esaustivo di coppie valore canale/alfa 0–255, oltre a fixture RGB e RGBA multicolore e RGBA interamente opaca. Confronto byte per byte, non visivo.
- Verificare IHDR di output: tipo 2/6 e profondità 8 corretti; nessuna conversione a palette. Verificare anche con decoder indipendente.
- Test input corrotti, dimensioni oltre limite, tipi non supportati, tRNS, APNG, profondità diverse e interlacciamento secondo policy.

### Motore

- Round-trip testo RGB, A e RGBA con ASCII e caratteri accentati; scansioni e bit diversi; capacità esatta, overflow e canali invalidi.
- Verificare che encode cambi soltanto i bit autorizzati e che tutti gli altri byte restino identici. Test A=0 e A=1.
- Maschere monocromatiche su RGB e A, piani e XOR con risultati attesi, statistiche e coppie miste.
- Regressione delle sei missioni esistenti e soluzione verificabile della missione 007.

### Interfaccia browser

Eseguire test reali in browser (manuali o automatizzati secondo strumenti disponibili): avvio, caricamento RGB/RGBA, errore locale, cambio missione/manuale, cambio formato, zoom/click/frecce, griglia, piani, estrazione, download e ricaricamento PNG, encoder testo e maschera, tab ASCII, esploratore RGBA, guida. Verificare console senza errori e layout a larghezze desktop e ridotte. Testare anche su GitHub Pages o equivalente server statico con percorso relativo al repository. Se non è possibile eseguire un test, dichiararlo esplicitamente e non considerarlo superato.

**Gate di rilascio:** zero alterazioni involontarie dei byte nei test di integrità; nessuna regressione nota bloccante. Se il codec non soddisfa il gate, fermarsi e proporre un'alternativa; non ripiegare su Canvas.

## 8. M6 — Documentazione e rilascio

Aggiornare README, changelog, guida HTML, specifiche tecniche, guida didattica ed eventuale AGENTS.md. Spiegare RGB/RGBA, alfa, premoltiplicazione, formati supportati, limiti, capacità e differenza fra piano di bit e XOR. Correggere ogni vecchio riferimento al divieto di trasparenza. Documentare licenze vendor e test. Aggiornare versione a 0.5.0 e cache busting coerente di CSS/JS solo a implementazione completata. Usare percorsi relativi compatibili con GitHub Pages.

Consegnare report finale con file modificati, architettura, dipendenze e versioni, test e risultati effettivi, limitazioni, istruzioni per prova locale e stato Git. Chiedere autorizzazione prima di commit/push se non già concessa. Dopo eventuale push su main verificare workflow Pages e versione pubblicata, senza presumere il successo del deployment.
