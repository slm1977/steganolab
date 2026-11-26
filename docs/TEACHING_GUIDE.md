# Guida didattica — SteganoLab 0.5.0

Destinatari: liceo, anche senza programmazione. Durata indicativa: 60–90 minuti. Le missioni sono sintetiche e pubbliche, non prove protette. Non usare dati personali o riservati: la steganografia non cifra né autentica.

## Preparazione del docente

Aprire [il laboratorio](../index.html) e [la guida per studenti](../guide.html) in un browser moderno. Non serve un servizio remoto; un server statico locale è opzionale, come descritto nel [README](../README.md). Preparare eventualmente PNG statiche RGB o RGBA a 8 bit, non interlacciate, entro 64 MiB e 4 milioni di pixel. Palette, scala di grigi, `tRNS`, APNG, Adam7 e altre profondità sono rifiutati. Non usare JPEG per conservare i bit.

## Percorso per studenti

1. Avvia la prima missione; confronta originale e sospetta e formula un'ipotesi. La modalità **Caricamento manuale** permette invece di usare uno o entrambi i propri reperti; per confronto e XOR occorrono dimensioni uguali.
2. Usa Differenze e ispeziona almeno cinque pixel, annotando coordinate e valori decimali e binari. Clicca un pixel e usa le frecce; zoom e griglia aiutano la lettura.
3. Raccogli dalla sospetta i bit nell'ordine ipotizzato, anche nei canali invariati. Raggruppali in byte MSB-first, decodifica e giustifica la scelta; confronta raccolta manuale, estrazione automatica e esploratore UTF-8. Il riepilogo dei bit permette di comprimere o espandere l’elenco dei byte senza perdere dati. In caso di UTF-8 non valido, l’anteprima indicativa usa � per le sequenze non valide: verifica lunghezza e parametri.
4. Esplora le missioni successive: per le figure osserva i piani e scaricali; per le tracce usa XOR. Nella missione 007 formula e verifica ipotesi senza cercare la soluzione nel codice. Scrivi una relazione distinguendo osservazioni e inferenze.
5. In **Steganografare** scegli un’immagine originale e crea un breve testo. Annota lunghezza e parametri, scarica e ricarica il reperto per verificarlo. Per una figura apri l’editor delle maschere di bit e disegna la figura; esplora il piano scelto nel risultato.

Un piano mostra bianco=1 e nero=0; XOR mostra bianco=bit cambiato e nero=invariato. Un bit invariato può comunque trasportare informazione. I controlli di visualizzazione, estrazione ed encoder sono indipendenti. La raccolta arriva a 65.536 bit, con anteprima dei primi 512.

## Concetti da discutere

- RGB ha 24 piani e nessun alfa reale; RGBA ne ha 32, anche se tutti i pixel sono opachi. A=0 è trasparente, A=255 opaco e i valori intermedi semitrasparenti. I valori RGB possono esistere anche sotto A=0: confrontali nel microscopio, non basarti solo sull'anteprima.
- L'esploratore **Colori RGBA** mostra bit, pesi, somme, riferimento, colore esadecimale e opacità. È una simulazione: non modifica il reperto. Per un pixel RGB l'alfa visualizzato è solo simulabile.
- Il codec locale preserva i valori grezzi non premoltiplicati; Canvas è usato solo per la vista. La premoltiplicazione può perdere o arrotondare RGB, soprattutto con poca opacità. I metadati accessori non sono conservati e l'anteprima può differire da altri visualizzatori per la gestione colore.
- La scansione parte da (0,0), per righe o per colonne, seguendo l'ordine dei canali scelti. Ogni canale usa un bit 0–7; i bit del byte si leggono dal più significativo. Non c'è intestazione: servono lunghezza, canali, bit e scansione. La capacità è `floor(larghezza × altezza × canali / 8)` byte UTF-8, non necessariamente caratteri.
- Le maschere binarie contengono un bit per pixel: nero = 0, bianco = 1. Il canale A è disponibile solo in RGBA.

## Terminologia dell’interfaccia

- Immagine originale (copertura): supporto dell’informazione nascosta.
- Immagine segreta: figura da nascondere; immagine steganografata: risultato.
- Canale di inserimento e Posizione del bit: scelgono dove memorizzare l’informazione.
- Rimuovi immagine originale: rimuove dal laboratorio, non dal disco.
- Genera e scarica immagine steganografata: crea e salva il risultato PNG.

I tooltip dei controlli forniscono spiegazioni contestuali al passaggio del puntatore.

## Tutor e valutazione

Il tutor complementare può usare [le istruzioni dedicate](../agent/STEGANOLAB_AGENT.md), ma non è integrato con il laboratorio: non vede click, pixel o file e deve chiedere allo studente di descriverli. Valutare osservazioni, correttezza binaria, metodo, motivazione e autonomia, non soltanto la risposta finale. Non rivelare la soluzione della missione 007. Per le verifiche tecniche e manuali vedere la [specifica](TECHNICAL_SPECIFICATION.md).
## Offset testuale (v0.5.1)
Coordinate X,Y intere, origine (0,0). Scansione per righe: indice y*w+x; per colonne: x*h+y. Capacità residua (w*h-indice)*numero canali. Encoder ed estrazione automatica usano lo stesso offset; raccolta manuale libera. Nessuna intestazione aggiunta. Le immagini binarie e le missioni esistenti restano invariate.

## Galleria di immagini di esempio (v0.5.3)
Nella scheda Steganografare scegliere una delle sei PNG statiche RGB/RGBA da 320 × 200 pixel oppure caricare un file dal PC. Le miniature caricano la copertura; Scarica PNG salva il file originale. Usare le immagini RGBA per esplorare il canale alfa.


L’Esploratore UTF-8 converte il testo in punti di codice Unicode e byte decimali, binari ed esadecimali, mostrando il totale di byte e bit. La tabella di riferimento comprende ASCII (0–127, un byte) e alcuni caratteri non ASCII. Un carattere visivo può comprendere più punti di codice.


Nella scheda Steganografare, dopo la generazione del testo o della figura binaria, l’anteprima del reperto compare accanto all’originale alla stessa scala. Sostituire l’originale o il reperto azzera l’anteprima. Su schermi molto stretti le immagini sono impilate.


Nel banco di analisi, Ctrl + rotellina ingrandisce o riduce attorno al puntatore; Shift + rotellina scorre orizzontalmente. La rotellina normale scorre le immagini confrontabili in sincronia. I riquadri mantengono un’altezza stabile al variare dello zoom.


Editor multipiano: nella sezione Maschere dei piani di bit, Apri editor delle maschere di bit apre una matrice canale/bit (24 RGB, 32 RGBA). Clic per invertire un pixel, trascinamento per disegnare, Shift + trascinamento per spostare, zoom e griglia. Attivare i piani desiderati e salvare le maschere in memoria; Genera e scarica immagine steganografata sostituisce solo i piani attivi partendo dall’originale. Le maschere hanno le dimensioni dell’originale e vengono azzerate quando cambia. Esportazione PNG per singolo piano; le maschere si creano direttamente nell’editor.


Generazione unica: selezionare esplicitamente testo UTF-8 e/o maschere dell’editor, quindi usare Genera e scarica immagine steganografata. Il riepilogo indica i piani inclusi; i conflitti sullo stesso piano bloccano la generazione. Nell’editor Ctrl/Cmd+Z annulla, Ctrl+Y o Ctrl/Cmd+Shift+Z ripristina.
