# SteganoLab 0.5.7

Laboratorio didattico di steganografia per studenti, anche senza programmazione. È un'app statica HTML/CSS/JavaScript: apri [index.html](index.html) in un browser moderno. Elaborazione e file restano locali; non servono account, CDN o servizi esterni.

In alternativa, dalla cartella del progetto avvia un server statico locale (necessario per caricare la galleria di esempio), per esempio con Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Apri <http://127.0.0.1:8000/> e interrompi il server con Ctrl+C. Non esporre il server a reti pubbliche o pubblicare dati degli studenti.

## Inizia

1. In **Steganalizzare**, avvia una missione sintetica oppure scegli **Caricamento manuale** e carica originale e/o sospetta. Per confrontare e usare XOR servono entrambe, delle stesse dimensioni.
2. Confronta le immagini, osserva Differenze e piani di bit, clicca un pixel e usa le frecce. Raccogli i bit della sospetta anche quando non sono cambiati, manualmente o con l'estrazione automatica; decodifica e annota osservazioni e ipotesi nella relazione.
3. In **Steganografare** usa l'originale corrente, scegli una delle sei PNG di esempio oppure carica una copertura dal PC. Scegli canali, bit e scansione, inserisci un testo UTF-8 e genera la PNG; per una figura usa una PNG segreta delle stesse dimensioni. Ricarica il risultato per controllarlo. I controlli di visualizzazione, estrazione ed encoder sono indipendenti.

La raccolta è limitata a 65.536 bit; la schermata ne mostra in anteprima i primi 512. La esploratore UTF-8 e l'esploratore RGBA aiutano a interpretare valori e bit; l'esploratore è una simulazione e non modifica il reperto.

## Formati e limiti

Sono supportate PNG statiche non interlacciate **RGB (tipo 2) e RGBA (tipo 6), a 8 bit per canale**, fino a 4.000.000 pixel e 64 MiB per file. Sono rifiutati palette, scala di grigi, profondità diverse da 8, trasparenza `tRNS`, APNG e interlacciamento Adam7. Non usare JPEG o altre conversioni che modificano i pixel.

RGB ha 24 piani e nessun canale A reale; RGBA ne ha 32, anche se tutti i pixel sono opachi. A=0 è trasparente, A=255 opaco. Il codec PNG locale usa Pako 2.1.0 vendorizzato e conserva i byte dei pixel non premoltiplicati, inclusi i valori RGB sotto A=0, e il tipo RGB/RGBA nell'esportazione del reperto. Il byte A=255 nel buffer RGB è solo padding. La premoltiplicazione può invece perdere valori RGB o arrotondarli, specialmente a bassa opacità: Canvas serve solo a visualizzare, non ad acquisire o esportare i dati steganografici.

I metadati accessori, inclusi profili colore e gamma, sono ignorati e non conservati nell'output; la resa dell'anteprima può quindi differire da quella di altri visualizzatori. La conservazione riguarda i pixel, non l'identità binaria del file PNG né i suoi metadati. I piani esportati sono PNG RGBA opache.

## Protocollo

Il testo è UTF-8, senza intestazione o terminatore: conserva lunghezza in bit e parametri. Da (0,0), la scansione procede per righe da sinistra a destra e dall'alto in basso oppure per colonne dall'alto in basso e da sinistra a destra. Per ogni pixel visita i canali distinti nell'ordine scelto, usando un bit di posizione 0–7 per canale. I bit di ciascun byte sono scritti e letti dal più significativo al meno significativo (MSB-first). La capacità è `larghezza × altezza × numero_canali` bit, cioè `floor(capacità / 8)` byte completi: un carattere UTF-8 può occupare più byte.

La maschera monocromatica usa un bit per pixel: la somma dei suoi RGB grezzi ≥ 384 vale 1, altrimenti 0. **L'alfa della maschera è ignorato**, anche per pixel completamente trasparenti; il canale di destinazione A è disponibile solo con copertura RGBA.

Le missioni sono esercizi sintetici pubblici: la steganografia non cifra né autentica. Non usare messaggi personali o riservati. Il tutor opzionale non è collegato alla UI e non vede eventi, pixel o file: bisogna descrivergli le osservazioni.

## Documentazione

- [Guida per studenti](guide.html) · [Guida didattica per il docente](docs/TEACHING_GUIDE.md)
- [Specifica tecnica](docs/TECHNICAL_SPECIFICATION.md) · [Codec e dipendenza Pako](vendor/README.md)
- [Istruzioni per il tutor separato](agent/STEGANOLAB_AGENT.md) · [Changelog](CHANGELOG.md)

## Verifiche

Dalla cartella del progetto, con Node.js:

```sh
node tests/core.test.js
node tests/png-codec.test.js
node tests/browser-ui.test.js
node tests/fixtures/browser-smoke.js
```

Il test codec richiede anche ImageMagick `convert` nel PATH e le fixture PNG in [tests/fixtures](tests/fixtures); confronta l'output con un decoder indipendente. Il test UI richiede Google Chrome nel PATH; per Chromium o un altro percorso compatibile usa, ad esempio, `BROWSER=/usr/bin/chromium node tests/browser-ui.test.js`. Avvia un server loopback e un profilo temporanei, con scenari automatizzati nel browser. Lo smoke test richiede Firefox nel PATH e verifica il solo codec, non l'interfaccia. Nessuno richiede pacchetti npm.

I test automatici non sostituiscono la verifica manuale nel browser: carica RGB e RGBA, ispeziona anche pixel trasparenti, genera e scarica un reperto, ricaricalo e controlla i valori; prova anche esportazione dei piani, navigazione e visualizzazione.


L’Esploratore UTF-8 converte il testo in punti di codice Unicode e byte decimali, binari ed esadecimali, mostrando il totale di byte e bit. La tabella di riferimento comprende ASCII (0–127, un byte) e alcuni caratteri non ASCII. Un carattere visivo può comprendere più punti di codice.

## Credits

**Autore:** Stefano Leone Monni. **Licenza:** [MIT](LICENSE).

SteganoLab è stato realizzato esclusivamente a fini didattici ed educativi.


Nella scheda Steganografare, dopo la generazione del testo o della figura binaria, l’anteprima del reperto compare accanto all’originale alla stessa scala. Sostituire l’originale o il reperto azzera l’anteprima. Su schermi molto stretti le immagini sono impilate.


Nel banco di analisi, trascina con il mouse un’immagine ingrandita per spostare la vista; se originale e sospetta sono confrontabili, lo spostamento è sincronizzato. Un clic breve continua a selezionare il pixel.


Nel banco di analisi, Ctrl + rotellina ingrandisce o riduce attorno al puntatore; Shift + rotellina scorre orizzontalmente. La rotellina normale scorre le immagini confrontabili in sincronia. I riquadri mantengono un’altezza stabile al variare dello zoom.
