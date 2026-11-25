# Guida didattica — SteganoLab 0.5.0

Destinatari: liceo, anche senza programmazione. Durata indicativa: 60–90 minuti. Le missioni sono sintetiche e pubbliche, non prove protette. Non usare dati personali o riservati: la steganografia non cifra né autentica.

## Preparazione del docente

Aprire [il laboratorio](../index.html) e [la guida per studenti](../guide.html) in un browser moderno. Non serve un servizio remoto; un server statico locale è opzionale, come descritto nel [README](../README.md). Preparare eventualmente PNG statiche RGB o RGBA a 8 bit, non interlacciate, entro 64 MiB e 4 milioni di pixel. Palette, scala di grigi, `tRNS`, APNG, Adam7 e altre profondità sono rifiutati. Non usare JPEG per conservare i bit.

## Percorso per studenti

1. Avvia la prima missione; confronta originale e sospetta e formula un'ipotesi. La modalità **Caricamento manuale** permette invece di usare uno o entrambi i propri reperti; per confronto e XOR occorrono dimensioni uguali.
2. Usa Differenze e ispeziona almeno cinque pixel, annotando coordinate e valori decimali e binari. Clicca un pixel e usa le frecce; zoom e griglia aiutano la lettura.
3. Raccogli dalla sospetta i bit nell'ordine ipotizzato, anche nei canali invariati. Raggruppali in byte MSB-first, decodifica e giustifica la scelta; confronta raccolta manuale, estrazione automatica e tabella ASCII.
4. Esplora le missioni successive: per le figure osserva i piani e scaricali; per le tracce usa XOR. Nella missione 007 formula e verifica ipotesi senza cercare la soluzione nel codice. Scrivi una relazione distinguendo osservazioni e inferenze.
5. In **Steganografare** scegli un’immagine originale e crea un breve testo. Annota lunghezza e parametri, scarica e ricarica il reperto per verificarlo. Per una figura usa «Nascondi immagine in bianco e nero» e carica un’immagine segreta delle stesse dimensioni; esplora il piano scelto nel risultato.

Un piano mostra bianco=1 e nero=0; XOR mostra bianco=bit cambiato e nero=invariato. Un bit invariato può comunque trasportare informazione. I controlli di visualizzazione, estrazione ed encoder sono indipendenti. La raccolta arriva a 65.536 bit, con anteprima dei primi 512.

## Concetti da discutere

- RGB ha 24 piani e nessun alfa reale; RGBA ne ha 32, anche se tutti i pixel sono opachi. A=0 è trasparente, A=255 opaco e i valori intermedi semitrasparenti. I valori RGB possono esistere anche sotto A=0: confrontali nel microscopio, non basarti solo sull'anteprima.
- L'esploratore **Colori RGBA** mostra bit, pesi, somme, riferimento, colore esadecimale e opacità. È una simulazione: non modifica il reperto. Per un pixel RGB l'alfa visualizzato è solo simulabile.
- Il codec locale preserva i valori grezzi non premoltiplicati; Canvas è usato solo per la vista. La premoltiplicazione può perdere o arrotondare RGB, soprattutto con poca opacità. I metadati accessori non sono conservati e l'anteprima può differire da altri visualizzatori per la gestione colore.
- La scansione parte da (0,0), per righe o per colonne, seguendo l'ordine dei canali scelti. Ogni canale usa un bit 0–7; i bit del byte si leggono dal più significativo. Non c'è intestazione: servono lunghezza, canali, bit e scansione. La capacità è `floor(larghezza × altezza × canali / 8)` byte UTF-8, non necessariamente caratteri.
- L’immagine segreta viene rappresentata con un bit per pixel: somma RGB grezza ≥ 384 vale 1, altrimenti 0. **Il suo alfa è ignorato**, quindi anche un pixel trasparente può produrre 1. Il canale A dell’immagine originale è disponibile solo in RGBA.

## Terminologia dell’interfaccia

- Immagine originale (copertura): supporto dell’informazione nascosta.
- Immagine segreta: figura da nascondere; immagine steganografata: risultato.
- Canale di inserimento e Posizione del bit: scelgono dove memorizzare l’informazione.
- Rimuovi immagine originale / Rimuovi immagine segreta: rimuovono dal laboratorio, non dal disco.
- Genera e scarica immagine steganografata: crea e salva il risultato PNG.

I tooltip dei controlli forniscono spiegazioni contestuali al passaggio del puntatore.

## Tutor e valutazione

Il tutor complementare può usare [le istruzioni dedicate](../agent/STEGANOLAB_AGENT.md), ma non è integrato con il laboratorio: non vede click, pixel o file e deve chiedere allo studente di descriverli. Valutare osservazioni, correttezza binaria, metodo, motivazione e autonomia, non soltanto la risposta finale. Non rivelare la soluzione della missione 007. Per le verifiche tecniche e manuali vedere la [specifica](TECHNICAL_SPECIFICATION.md).