# SteganoLab — Base di conoscenza tecnico-didattica per agenti IA
Versione 0.5.1. Fonte: index.html, app.js, core.js, guide.html e specifica tecnica del repository slm1977/steganolab, branch main. Laboratorio: https://slm1977.github.io/steganolab/ . Guida: https://slm1977.github.io/steganolab/guide.html . Questo documento descrive il comportamento del sorgente, non certifica il deployment o il collaudo. Non contiene soluzioni delle missioni.

## 1. Scopo e architettura
Laboratorio web statico HTML/CSS/JS, elaborazione locale, nessun invio automatico delle immagini. Non richiede programmazione. Steganografia nasconde l'esistenza dell'informazione, non la cifra né autentica. Il tutor è separato e non riceve lo stato dell'app. Le due schede condividono originale e sospetta; Steganografare appare per prima, Steganalizzare è attiva all'avvio con una missione sintetica. Tabella ASCII, Colori RGBA e Guida all’uso sono strumenti comuni.

## 2. Immagini, pixel e formati
Originale (copertura): supporto; immagine segreta: figura da nascondere; immagine steganografata: risultato; sospetta: reperto da analizzare, non necessariamente contenente un messaggio.
Coordinate intere zero-based: X verso destra, Y verso il basso; limiti 0..W-1, 0..H-1. RGB: tre canali, 24 bit/pixel, 24 piani; RGBA: quattro, 32 bit/pixel, 32 piani. Ogni canale ha 8 bit, valori 0–255. A=0 trasparente, 255 opaco, 128 circa 50% opaco. RGBA può essere interamente opaca; RGB non possiede A reale, il padding interno 255 non è utilizzabile. RGB sotto A=0 esiste e partecipa alla codifica e all'estrazione.
PNG statiche RGB (tipo 2) o RGBA (tipo 6) native a 8 bit/canale, non interlacciate; massimo 4 milioni di pixel e 64 MiB. Palette, scala di grigi, tRNS, APNG, Adam7 e altre profondità rifiutati. Estensione PNG non garantisce compatibilità. Il codec PNG usa Pako 2.1.0 locale per DEFLATE, conserva campioni non premoltiplicati e tipo nativo; Canvas è solo anteprima. Premoltiplicazione può perdere RGB sotto alfa zero e arrotondare valori con alfa intermedio. Metadati accessori non conservati, nessuna conversione gamma/ICC; output non necessariamente identico a livello di file. Non convertire in JPEG.
Il messaggio di caricamento riporta nome, dimensioni, formato, bit/canale, bit/pixel, piani, presenza alfa e trasparenza effettiva. Il selettore nativo può mostrare Nessun file selezionato anche dopo successo: il campo viene azzerato, leggere lo stato sottostante. Annullare la scelta mantiene i reperti; un nuovo caricamento fallito può lasciare vuoto lo slot. Rimuovere immagini non cancella file dal disco.

## 3. Fondamenti binari
Posizioni da 7 a 0, pesi 128 64 32 16 8 4 2 1. LSB=0, MSB=7. Esempio 100=01100100; impostare LSB a 1 produce 101=01100101. Sostituire un bit k cambia il valore di 0 o ±2^k. Differenza numerica 1 non implica un solo bit diverso: 127 e 128 differiscono in tutti gli otto bit. XOR evidenzia le posizioni cambiate. Un bit invariato può trasportare informazione. Non estrarre soltanto i bit evidenziati.
Testo UTF-8: byte in ordine, bit di ogni byte dal 7 allo 0 (MSB-first), indipendentemente dalla posizione scelta nel canale ospite. ASCII 0–127 coincide con UTF-8 a un byte. A=65=01000001=0x41; é= C3 A9 (16 bit). Non confondere caratteri, byte e bit. Nessuna intestazione, terminatore, cifratura o rilevamento automatico della lunghezza. 

## 4. Steganografare: testo
1. Apri Steganografare; usa Immagine originale (copertura) corrente oppure Carica PNG. Caricare una nuova copertura elimina la precedente sospetta; se in Missioni passa a Caricamento manuale.
2. Canali di inserimento: scegli una sequenza ordinata di canali distinti, anche un solo canale. RGB e BGR sono diversi; A disponibile solo per RGBA. Posizione del bit: 0–7. Ordine di scansione: Per righe o Per colonne.
3. Pixel di partenza (offset): X,Y, default (0,0). Ripristina (0, 0) azzera le coordinate; Usa pixel selezionato copia le coordinate di selezione. Cliccare l'anteprima della copertura imposta direttamente l'offset. Contorno arancione indica l'offset. Coordinate intere entro immagine; controllare dopo sostituzione di immagini. Le missioni ripristinano entrambi gli offset.
4. Scrivi Messaggio. Leggi capacità residua e lunghezza effettiva UTF-8. Genera e scarica immagine steganografata produce reperto.png, preservando dimensioni e formato. L'originale resta invariato; la sospetta diventa il risultato.
5. Analizza il reperto generato apre Steganalizzare in modalità manuale preservando i due reperti. Non trasferisce automaticamente i parametri di estrazione: impostarli esplicitamente. È possibile ricaricare il PNG scaricato per verificare il round trip.
Rimuovi immagine originale rimuove l'originale condiviso e azzera lo stato investigativo, non necessariamente la sospetta. I tooltip spiegano i controlli.

## 5. Scansione, offset e capacità
Per righe: (0,0),(1,0),...,(W-1,0),(0,1)...; indice iniziale i=Y*W+X.
Per colonne: (0,0),(0,1),...,(0,H-1),(1,0)...; i=X*H+Y.
Dal pixel iniziale fino alla fine, senza ritorno all'inizio; per ogni pixel visitare tutti i canali nell'ordine scelto, un bit per canale. Capacità residua=(W*H-i)*numero_canali bit; byte completi=floor(bit/8). I pixel precedenti non sono modificati. Scrivere solo i bit necessari al messaggio.
Esempio W=4,H=3, offset (1,1), RGB: per righe i=5, 7 pixel, 21 bit, 2 byte; per colonne i=4, 8 pixel, 24 bit, 3 byte. Cambiare scansione cambia capacità e ordine. Ultimo pixel: solo tanti bit quanti canali scelti, insufficienti per un byte. 
Esempio A con RGB e scansione per righe: (0,0) R=0 G=1 B=0; (1,0) R=0 G=0 B=0; (2,0) R=0 G=1; sono i bit da scrivere, non i valori decimali dei canali. L'ultimo B non è utilizzato per questo byte.

## 6. Steganografare: immagine segreta
Nascondi immagine in bianco e nero: carica Immagine segreta PNG compatibile con dimensioni identiche all'originale. Può essere a colori; viene binarizzata usando somma RGB grezza >=384 come 1 (bianco), altrimenti 0 (nero). Alfa della figura ignorato. Esempio (128,128,128) bianco, (127,127,127) nero. Canale di inserimento e Posizione del bit selezionano un solo piano della copertura. Genera e scarica immagine steganografata produce reperto-immagine.png. Ogni pixel della figura occupa un bit del pixel corrispondente; offset testuale e scansione testuale non si applicano. Rimuovi immagine segreta rimuove soltanto la figura caricata. Per recuperare la figura visualizzare Piano di bit con canale e posizione corretti e Scarica piano PNG; non usare decodifica testuale. L'immagine a colori originale della figura non è recuperabile dalla binarizzazione.

## 7. Steganalizzare: reperti e banco di analisi
Reperti digitali: Missioni (seleziona e Avvia missione, Percorso guidato con Indietro/Avanti) oppure Caricamento manuale (Originale PNG e Sospetta PNG, anche uno solo). Cambiare modalità normalmente azzera reperti, raccolta e note. Rimuovi originale / Rimuovi sospetta agiscono sui rispettivi slot. 
Banco di analisi: Vista Sospetta, Originale, Differenze, Piano di bit, Piano differenze XOR. Differenze e XOR richiedono entrambi i reperti con dimensioni uguali. Due RGBA confrontano anche A; coppia mista RGB/RGBA confronta solo RGB. Differenze evidenzia in rosso pixel alterati, non indica direttamente payload. Statistiche: pixel alterati, valori di canale alterati, variazione assoluta massima e conteggi per canale; un pixel può avere più valori alterati. Segnala anche differenze che coinvolgono A=0.
Piano di bit: bianco=1, nero=0, usa sospetta se presente altrimenti originale. XOR: bianco=bit diverso, nero=uguale. Canale da visualizzare e Piano da visualizzare sono indipendenti da estrazione ed encoder. Scarica piano PNG esporta piano.png opaco. XOR A richiede entrambe RGBA.
Zoom, Griglia pixel (visibile da zoom 5x), Adatta (ridimensiona la vista) non alterano i dati. Clicca pixel, usa frecce o X,Y e Ispeziona. Pixel successivo percorre per righe, indipendentemente dalla scansione di estrazione. La tabella mostra decimali e binari originali e sospetti; bit sospetti cliccabili, differenze evidenziate. Anche pixel trasparenti ispezionabili. Esplora il colore del pixel apre simulazione RGBA.

## 8. Banco di estrazione
Manuale: cliccare i bit della sospetta nella sequenza desiderata, anche invariati. Ogni click aggiunge un bit; non modifica l'immagine. Offset e selettori non limitano la raccolta manuale.
Automatico: Canali in ordine, Bit da estrarre, Scansione, Pixel di partenza (offset), Numero bit. Impostare gli stessi parametri usati per scrivere, se noti. Usa pixel selezionato copia le coordinate; Ripristina (0, 0) azzera offset. Raccogli automaticamente sostituisce la raccolta corrente con N bit. Limite 1–65536 bit e capacità residua. Cambiare parametri non ricalcola i bit già raccolti: premere nuovamente Raccogli automaticamente.
Annulla bit elimina solo l'ultimo; Svuota elimina tutti. Entrambi aggiornano provenienza e azzerano il risultato decodificato. Riepilogo collassabile mostra numero bit, byte completi e residui; chiuderlo non perde dati. Anteprima primi 512 bit (64 byte), non limite di decodifica. Ogni gruppo ha numero d'ordine da 1, coordinate distinte nell'ordine di raccolta, tooltip con coordinate/canale/posizione per ogni bit, celle e valore decimale se completo. Un byte può attraversare più pixel. Consulta tabella ASCII apre ricerca; Decodifica UTF-8 / ASCII usa UTF-8 rigoroso.
Registro investigativo: Ipotesi, osservazioni e conclusioni; Scarica relazione genera relazione.md con descrizione caso, note, bit e decodifica. Non include automaticamente tutti i parametri: annotarli.

## 9. Strumenti didattici
Tabella ASCII (0–127): carattere, decimale, binario a 8 bit, Hex; ricerca per carattere, decimale, prefisso binario o esadecimale 0x. ASCII usa 7 bit, qui rappresentati su 8. 
Colori RGBA: slider, numeri e bit modificabili; pesi delle potenze di due e somma decimale, confronto Riferimento/Colore corrente, delta, esadecimale RGBA e opacità. Fissa come riferimento, Ripristina riferimento, colori comuni. Esplora il colore del pixel importa i valori; se confrontabili usa originale come riferimento. Su RGB A è solo simulabile. Nessuna modifica ai reperti.

## 10. Diagnostica
- PNG non caricata: leggere errore sotto campo; verificare tipo colore, profondità, interlacciamento, dimensioni, dimensione file. Non dedurre dal nome. Nessun file selezionato può essere normale se lo stato dice Caricato.
- Generazione disabilitata: originale assente, offset invalido o capacità insufficiente. Messaggio vuoto rifiutato al click. Per figura servono entrambi i file e dimensioni uguali.
- Confronto/XOR disabilitati: mancano reperti o dimensioni diverse. A assente: verificare formato nativo, non solo trasparenza visibile.
- UTF-8 non valido: numero bit multiplo di 8 necessario ma non sufficiente. Verificare lunghezza UTF-8 indicata dall'encoder, canali e ordine, posizione bit, scansione, offset e file corretto. Il simbolo � nell'anteprima indica sostituzione di sequenze non valide; non è una soluzione. Esempio 80 bit=10 byte, ma 10010110 (0x96) non può iniziare un carattere UTF-8 da solo. Se bit residui, raccogliere gruppi completi. Anche testo valido può essere casuale o errato. Non assumere che l'errore sia del codec.
- Immagini apparentemente identiche: normale con LSB o RGB sotto A=0; verificare differenze e valori grezzi.
- Figura non riconoscibile: verificare piano/canale, non XOR; la figura è binaria, non a colori.
- Offset fuori immagine: coordinate intere entro limiti, ripristinare (0,0) se opportuno. Non confondere pixel ispezionato e offset.
- Byte senza coordinate visibili: espandere riepilogo; controllare versione. Non inventare provenienza di bit non riportati.
- Parametri discordanti: vista, encoder ed estrazione sono indipendenti. Una modifica alla vista non modifica i bit estratti.

## 11. Missioni (senza soluzioni)
001 Il segreto della Sella del Diavolo: ricostruire 4 caratteri; introdurre confronto e raccolta.
002 Il segnale del faro: 4 caratteri in un solo canale; formulare ipotesi sui canali.
003 Le coordinate perdute: 4 caratteri, esplorare scansioni differenti.
004 Il simbolo nascosto: esplorare i 24 piani e riconoscere una figura.
005 La mappa del tesoro: cercare percorso e destinazione nei piani.
006 Le tracce digitali: usare XOR per individuare canali e bit alterati, ricostruire 4 caratteri.
007 Il segreto della trasparenza: individuare alterazioni RGBA, ricostruire 4 caratteri UTF-8 (32 bit).
001–003,006,007: 32×20; 004–005: 64×48; solo 007 RGBA. Missioni sintetiche, offset zero. Indizi graduati: osserva, formula ipotesi, ispeziona almeno cinque pixel, verifica con raccolta/piano, documenta. Non rivelare soluzioni né suggerire di cercarle nel sorgente.

## 12. Percorso didattico e verifica
Prova libera: scegli una PNG, nascondi A in LSB RGB a offset noto, annota parametri, confronta e recupera 8 bit. Ripeti con offset diverso e scansione per colonne; confronta capacità. Prova é per distinguere byte e caratteri. Con RGBA esplora pixel trasparenti e differenze. Per figure prova una PNG delle stesse dimensioni e recupera il piano. Valuta capacità di spiegare scelte, calcoli, evidenze e limiti, non solo risultato.
Il tutor può chiedere: versione, attività, dimensioni/formato, parametri encoder/estrazione, coordinate, bit raccolti, esito, screenshot se disponibile. Non riceve questi dati automaticamente. Non chiedere contenuti riservati. 
## 13. Riferimenti e manutenzione
https://github.com/slm1977/steganolab — sorgenti index.html, app.js, core.js, png-codec.js, docs/TECHNICAL_SPECIFICATION.md, docs/TEACHING_GUIDE.md. In caso di incongruenze con guide precedenti, questa base segue il codice 0.5.1 ispezionato. Aggiornare con ogni modifica a UI, protocollo, limiti o missioni. Non presentare funzionalità future come già disponibili.
