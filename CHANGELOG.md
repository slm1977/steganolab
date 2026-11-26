# Changelog

## 0.6.5
- Messaggio multilinea e contatore dinamico dei byte UTF-8 residui.
- Generazione anteprima senza download; salvataggio PNG separato.

## 0.6.4
- Editor maschere: dimensioni reali, numero di pixel e coordinate/bit del puntatore in tempo reale; griglia visibile da zoom 2×.

## 0.6.3
- Encoder disabilitato fino al caricamento di una PNG originale manuale o di esempio; informazioni delle immagini richiudibili.

## 0.6.2
- Rimosso il caricamento di PNG segrete, anche nell’editor; sezione maschere multipiano evidenziata e riepilogo dei piani attivi. Generazione unica per testo e/o maschere.

## 0.6.1
- Generazione unica con inclusione esplicita di testo, maschere editor e PNG segreta; blocco dei conflitti sui piani.
- Scorciatoie standard annulla/ripristina nell’editor.

## 0.6.0
- Editor multipiano di maschere binarie: 24 piani RGB o 32 RGBA, attivazione indipendente, disegno, import/export PNG e generazione simultanea.

## 0.5.8
- Esploratore UTF-8 più ampio, ridimensionabile, con campo testo a tutta larghezza e tabelle scorrevoli.

## 0.5.7
- Zoom centrato sul puntatore con Ctrl + rotellina, scorrimento sincronizzato e Shift + rotellina orizzontale.
- Riquadri di analisi ad altezza stabile e controlli raggruppati in righe adattive.

## 0.5.6
- Pan mediante trascinamento del mouse sulle immagini ingrandite, cursori grab/grabbing e sincronizzazione delle immagini confrontabili. Il clic breve continua a selezionare il pixel.

## 0.5.5
- Anteprime affiancate dell’originale e del reperto generato, sia per testo sia per figura binaria; risultato invalidato al cambio dell’originale o del reperto.

## 0.5.4
- Sezione Credits con autore, licenza MIT e finalità didattiche ed educative; allineata l’attribuzione nel file LICENSE.

## 0.5.3
- Esploratore UTF-8 con conversione interattiva, punti di codice Unicode, byte decimali/binari/esadecimali e conteggi; riferimento ASCII e simboli comuni integrato.

## 0.5.2
- Galleria di sei PNG statiche (tre RGB e tre RGBA, 320 × 200, 8 bit) in `images/examples/`, selezionabili e scaricabili nella scheda Steganografare.
- Caricamento PNG dal PC invariato; aggiornate guida utente e base di conoscenza IA.
- Decodifica delle sei risorse e sintassi JavaScript verificate; test browser e deploy da verificare.

## 0.5.0
- Codec PNG locale con Pako 2.1.0 per PNG statiche RGB/RGBA a 8 bit: analisi ed esportazione dei pixel non premoltiplicati senza passare da Canvas. I metadati accessori non sono conservati.
- Canale alfa, piani e differenze RGBA, esploratore RGBA e missione 007; caricamento manuale separato dalle missioni. Nessuno spoiler sulla soluzione.
- Rifiuto di `tRNS`, APNG, Adam7 e formati non supportati; limiti di 64 MiB e 4 milioni di pixel. La soglia della maschera ignora il suo alfa.
- Protocollo UTF-8 senza intestazione e MSB-first mantenuto; documentazione e istruzioni di verifica aggiornate.

## 0.4.2
RGB explorer: positional powers of two, active weight highlighting and live decimal decomposition.
## 0.4.1
Interactive RGB explorer, reference comparison, bit toggles, common color palette and selected pixel import. Browser validation pending.
## 0.4.0
Analysis and encoding tabs, compact zoom/grid controls, searchable ASCII dialog and HTML guide. Shared current cover, browser validation pending.
## 0.3.0
XOR bit planes, monochrome image embedding and PNG plane export, three new synthetic missions, keyboard pixel navigation with viewport tracking. Browser tests pending.
## 0.2.0
Separate visualization, extraction and encoder parameters; side-by-side images, selected pixel marker, optional grid, byte boxes, ASCII reference and guided investigation. Synthetic missions retained; browser validation pending.
## 0.1.0
Initial static prototype: PNG import, RGB inspector, difference map, bit planes, manual/automatic extraction, UTF-8 decoder, encoder, three synthetic missions, Markdown report and complementary tutor. Browser validation pending.
## 0.5.1
- Offset testuale X,Y in inserimento ed estrazione, capacità residua, selezione grafica e coordinate dei byte coerenti.
