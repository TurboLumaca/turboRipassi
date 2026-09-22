# La costituzione di TurboRipassi

*Scritta finché il prodotto è piccolo, perché è l'unico momento in cui si può.*

Questo documento non descrive che cosa l'app fa: quello lo dice il codice.
Descrive che cosa l'app **non farà**, e perché ogni singola voce di quell'elenco
verrà proposta, in buona fede, da qualcuno che ha ragione dentro il proprio
sistema di incentivi.

Non è un manifesto. È materiale da citare in una riunione.

---

## 1. Il criterio

La dopamina non è la molecola del piacere: è il segnale di insegnamento del
cervello. I neuroni dopaminergici codificano l'**errore di predizione della
ricompensa** (Schultz, Dayan & Montague, 1997): scaricano quando l'esito supera
la previsione, tacciono quando la delude. Il sistema si è evoluto *per
imparare*. Una slot machine è, in senso letterale, un'esperienza di
apprendimento contraffatta: emette errori di predizione senza contenuto.

Questo dà a un'app di apprendimento un vantaggio strutturale che le slot non
hanno: **il richiamo genera errori di predizione autentici**, legati a contenuto
reale. Il discrimine fra una meccanica accettabile e una predatoria non è quindi
"è divertente o no", ma:

> Questa meccanica emette errori di predizione **sintetici** — autonomi dal
> contenuto — o **inoltra** quelli che il richiamo genera comunque?

E il filtro finale, il test di svalutazione (Dickinson & Balleine, sul passaggio
dal comportamento *goal-directed* a quello abituale):

> **Se l'utente decidesse che non ne vale più la pena, riuscirebbe a smettere?**
> Se la risposta è no, non si spedisce.

---

## 2. La lista dei MAI

Vincolante. Fa parte dell'onboarding di chiunque lavori su questo prodotto.
Ogni voce fallisce almeno uno dei due criteri qui sopra.

1. **Daily check-in bonus.** Una ricompensa consegnata per il gesto di aprire è
   il primo mattone dell'edificio-slot: disaccoppia il rinforzo
   dall'apprendimento. Arriverà proposta come "gamification leggera".
2. **XP e livelli astratti.** Un livello è fabbricabile e vendibile. La
   maturazione di un concetto no: la si può solo aspettare.
3. **Avatar e cosmetici.** Aprono l'inflazione della rarità, e da lì la
   Cerimonia di Promozione — che deve restare l'evento raro e gratuito più
   grande dell'app — è compromessa.
4. **Suono o celebrazione su ogni spunta.** Vedi il budget del juice
   (`src/view/theme/juice.ts`): la spunta quotidiana è di livello `quieto`, e
   lo resta.
5. **Streak giornaliera binaria come metrica di testa.** Crea un asset
   sintetico concorrente da proteggere, e il Patrimonio torna a essere gear di
   WoW.
6. **Valore a scadenza, in qualsiasi forma** — battle pass, tier che muoiono,
   bonus che decadono. È la singola meccanica più incompatibile con questo
   prodotto: contraddice frontalmente la Modalità Riposo e genera il
   review-debt che uccide Anki.
7. **Leaderboard pubbliche e confronto sociale.** Sostituiscono la motivazione
   intrinseca con una posizionale.
8. **Confirmshaming.** "No grazie, preferisco dimenticare" non si scrive.
9. **Vendere probabilità.** Nessuna casualità a pagamento, mai, in nessuna
   forma.
10. **Ricompense casuali all'apertura o al completamento.** Il *testing effect*
    è già uno schedule naturale a rapporto variabile: il richiamo riesce o
    fallisce con imprevedibilità genuina. Non c'è varianza da aggiungere — c'è
    solo da rendere visibile quella che esiste.

---

## 3. La North Star, e le metriche subordinate

**Metrica di testa: promozioni a Permanente per utente.**

Le metriche di engagement sono subordinate e hanno **tetti**, non obiettivi:

- Sessione mediana target **5–8 minuti**. Se sale sopra il tetto, *si indaga*,
  non si festeggia.
- Tasso di terminazione dignitosa: sessioni concluse con la Schermata di
  Chiusura contro sessioni abbandonate a metà coda. Deve salire.

**Il canarino — rendimento formativo:**

```
promozioni a Permanente / utente attivo / trimestre
```

Vive nel codice (`src/model/ripassi/patrimonioLogic.ts`) e sullo schermo del
Profilo, non in una dashboard interna. Una metrica che vive solo in un
documento, alla terza riunione, non esiste più.

Come si legge:

| Retention | Rendimento | Lettura |
|---|---|---|
| ↑ | ↑ | Allineati. Si scala. |
| piatta | ↓ | Si sta comprando engagement con meccaniche artificiali. Fermarsi. |
| ↑ | stagnante | **È diventato un casinò con un piano di studi.** La missione è fallita anche se il business cresce. |

---

## 4. La regola del test asimmetrico

Nessun esperimento può essere rilasciato se **migliora l'engagement senza
migliorare o preservare** il rendimento formativo e l'autonomia percepita.

Il motivo è strutturale, non morale: gli A/B test misurano finestre di una o due
settimane, e gli effetti sull'apprendimento e sulla motivazione intrinseca
maturano in mesi. Ne segue che **l'infrastruttura di sperimentazione è di per sé
un attore pro-engagement**, senza bisogno di cattiva volontà. Un test fra una
versione colpevolizzante di "In ritardo" e una neutra vedrà vincere la colpa su
D7, e il team la spedirà sentendosi scientificamente giustificato.

Finestra minima di valutazione per qualsiasi cambiamento che tocchi una
ricompensa: **8 settimane**.

---

## 5. Modello di ricavo

**Sottoscrizione pura. Zero pubblicità.**

Con la pubblicità il ricavo è proporzionale al tempo nell'app: la divergenza fra
"l'utente impara" e "l'utente resta" non è un rischio, è una certezza
architetturale. Con la sottoscrizione il ricavo è proporzionale al valore
percepito, e l'allineamento *può* reggere.

L'introduzione di un modello ad-based segna il punto di non ritorno.

---

## 6. Le cose che verranno proposte

In ordine di probabilità. Sono previsioni, non accuse: ognuna è razionale
*dentro* il sistema di incentivi di chi la propone.

1. **"Pausa rapida × 5"**, come catena. Arriverà presentata come richiesta
   degli utenti. Gli utenti chiedono sempre più meccanica; distinguere la
   richiesta dall'interesse formativo è il lavoro.
2. **Daily check-in bonus.** Vedi MAI n. 1.
3. **Depriorizzazione della Modalità Riposo.** Congelando le scadenze porta a
   meno notifiche e meno DAU a finestra breve: è strutturalmente la feature che
   perde ogni prioritizzazione basata su metriche a breve. È difesa qui e da un
   test (`useSessioneGiornaliera`: in Riposo non si anticipa niente).
4. **A/B test su "In ritardo"**, con vittoria della versione basata sulla colpa
   su D7. Vedi la regola del test asimmetrico.
5. **Uno scroll di "concetti consigliati".** L'infinite scroll entra sempre
   dalla porta dei contenuti, mai da quella dell'interfaccia.
6. **La streak-flex card** ("condividi il tuo impegno").
7. **Monetizzazione cosmetica**, e con lei l'inflazione della rarità.

---

## 7. Audit trimestrale

Ogni feature viene rivalutata con una domanda binaria: **è informativa o
controllante?** — con effettivo potere di rimozione del codice.

Due domande di survey, trimestrali:

1. *Mi sento controllato da quest'app?*
2. *Ho imparato qualcosa che uso fuori dall'app?*

L'autonomia percepita è il barometro.

---

## 8. L'ultima onestà

La fisica del prodotto aiuta: se l'asset vive nella testa dell'utente e il
ricavo è la sottoscrizione, chi impara davvero è anche chi non se ne va.
L'allineamento è possibile e difendibile.

Ma non si eredita. Si ri-vince a ogni round di finanziamento, a ogni assunzione,
a ogni A/B test, a ogni planning in cui la Modalità Riposo compete con una
notifica in più.

La decisione etica principale della vita di questo prodotto non è nessuna delle
micro-meccaniche discusse qui. È **quale funzione obiettivo l'organizzazione
accetta di usare per misurare il proprio successo** — e tutto il resto è a
valle di quella.
