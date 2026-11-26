# Changelog

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
