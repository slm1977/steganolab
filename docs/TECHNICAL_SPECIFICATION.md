# Specifica tecnica — SteganoLab 0.5.0

## Architettura e formato

Applicazione statica HTML/CSS/JavaScript, senza servizi esterni. Il codec PNG locale usa Pako 2.1.0 vendorizzato per DEFLATE; non usa Canvas o conversioni colore. Il motore deterministico è utilizzabile anche in Node. Le missioni sono immagini sintetiche. Informazioni sul codec, licenza e test sono in [vendor/README.md](../vendor/README.md).

Il decoder accetta PNG statiche non interlacciate, tipo colore 2 RGB o 6 RGBA, a 8 bit per canale. Dimensioni positive, massimo **4.000.000 pixel**, **64 MiB** per file e 100.000 chunk. Rifiuta tipi a palette o scala di grigi, profondità diverse da 8, `tRNS`, chunk APNG e Adam7; controlla firma, struttura, ordine e CRC dei chunk, intestazione zlib, lunghezza dei dati decompressi e Adler-32. Chunk critici sconosciuti, IDAT non consecutivi e dati dopo IEND sono rifiutati. I cinque filtri PNG sono gestiti; PLTE opzionale valido in RGB/RGBA non viene usato come conversione di palette.

I chunk accessori sono ignorati e non conservati nell'output; la loro semantica interna non è interamente validata. Nessuna conversione gamma/ICC è applicata ai dati: l'anteprima può differire da visualizzatori con gestione colore. Il codec non è un validatore completo di tutti i metadati PNG.

## Buffer, alfa e rendering

Il buffer canonico contiene quattro byte per pixel RGBA **non premoltiplicati**, più dimensioni, tipo colore, profondità e stato alfa. In RGB il quarto byte è padding 255, non un canale A utilizzabile. RGBA ha A reale anche quando tutti i valori sono 255; la trasparenza effettiva richiede almeno un A diverso da 255. A=0 è trasparente, A=255 opaco. Il codec conserva anche RGB sotto A=0: premoltiplicazione e successiva divisione possono perdere tali valori o introdurre arrotondamenti.

Analisi, ispezione, estrazione, codifica ed esportazione operano sul buffer grezzo. Canvas è soltanto un'anteprima: non si legge da esso per acquisire i pixel né lo si usa per esportare i reperti. L'anteprima può rendere invisibili differenze nei pixel trasparenti. I reperti esportati mantengono il tipo nativo RGB o RGBA e la profondità 8, ma non i metadati accessori né necessariamente gli stessi byte del file originario. I piani esportati provengono dal proprio buffer RGBA opaco.

## Protocollo

Il testo è UTF-8 senza intestazione o terminatore. Ogni byte viene scritto MSB-first, dal bit 7 al bit 0. Da (0,0), `row` percorre le righe da sinistra a destra e dall'alto in basso; `col` percorre le colonne dall'alto in basso e da sinistra a destra. Per ogni pixel si visitano i canali distinti nell'ordine selezionato, usando un bit di posizione 0–7 per canale; A è disponibile solo per RGBA nativa. Anche bit invariati e pixel trasparenti partecipano. La lunghezza in bit e i parametri devono essere noti o ipotizzati.

La capacità è `larghezza × altezza × numero_canali` bit, ovvero `floor(capacità_bit / 8)` byte UTF-8 completi. La decodifica richiede gruppi completi e UTF-8 valido. L'interfaccia raccoglie al massimo 65.536 bit, manualmente o automaticamente, e ne mostra i primi 512. Non c'è cifratura né autenticazione.

Per la figura monocromatica maschera e copertura hanno dimensioni uguali. La somma RGB grezza della maschera ≥ 384 produce 1, altrimenti 0: **l'alfa della maschera è ignorato**. Un bit per pixel viene scritto nel canale e piano scelti, senza intestazione; A come destinazione richiede copertura RGBA. Il codice modifica solo il bit selezionato nelle posizioni utilizzate e mantiene gli altri valori.

## Analisi e interfaccia

Un piano mostra bianco=1 e nero=0; XOR mostra bianco=bit cambiato e nero=invariato. Differenze e XOR richiedono immagini di uguali dimensioni. Due RGBA confrontano anche A; una coppia RGB/RGBA confronta solo RGB e non consente XOR A. Le statistiche riportano pixel e valori alterati, massima variazione e conteggi per canale; la vista Differenze segnala i pixel alterati che coinvolgono A=0.

Le modalità Missioni e Caricamento manuale sono separate. Passando dall'una all'altra si azzerano reperti e stato investigativo; si può analizzare un singolo reperto. Il caricamento gestisce errori e selezioni concorrenti; l'annullamento non sostituisce i reperti correnti. Visualizzazione, estrazione ed encoder hanno parametri indipendenti. Il microscopio legge valori grezzi; zoom, griglia e navigazione non li alterano. L'esploratore RGBA è una simulazione separata; su RGB il suo A è soltanto simulato.

## Verifiche

Dal progetto: `node tests/core.test.js` per protocollo, RGBA e regressioni; `node tests/png-codec.test.js` per fixture, filtri, controlli e confronto con ImageMagick `convert`, richiesto nel PATH. `node tests/browser-ui.test.js` usa Chrome headless, un server loopback e un profilo temporanei; `BROWSER` consente di specificare un altro eseguibile compatibile. `node tests/fixtures/browser-smoke.js` usa Firefox headless e verifica il solo codec. Sono necessarie le fixture PNG presenti in `tests/fixtures`; non servono pacchetti npm. Questi comandi descrivono le verifiche disponibili, non attestano una loro esecuzione.

Verificare anche manualmente nel browser caricamento RGB/RGBA, ispezione dei pixel, esportazione e ricaricamento dei reperti e dei piani, navigazione e resa. Il tutor è separato e non riceve automaticamente eventi, pixel o file della UI.