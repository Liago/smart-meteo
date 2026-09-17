# Versioning

## Il problema che risolve

Smart Meteo dichiarava una versione in cinque posti — tre `package.json`, il
progetto Xcode e, a voce, la schermata impostazioni — e in nessuno di quei
posti la dichiarava *davvero*: l'app è rimasta a `1.0 (1)` per tutta la sua
vita, mentre passavano il ridisegno iOS, nove connettori, le allerte personali
e la riorganizzazione della dashboard web.

Un numero di versione fermo non è un dettaglio estetico. È l'unica cosa che
lega una segnalazione («da stamattina il mare non compare») a un rilascio, e
senza di lei ogni indagine parte da «quale build hai?» → «non lo so».

## Come funziona

Una sorgente di verità, `version.json` in radice:

```json
{
  "version": "1.1.0",
  "build": 2
}
```

Tutto il resto è **derivato** e non si modifica a mano:

| File | Cosa riceve |
| --- | --- |
| `package.json` (radice, `backend/`, `frontend-web/`) | `version` |
| `backend/version.ts` | `APP_VERSION`, `APP_BUILD`, `APP_VERSION_FULL` |
| `frontend-web/lib/version.ts` | idem |
| `frontend-ios/…/project.pbxproj` | `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION` |

Su iOS `GENERATE_INFOPLIST_FILE = YES`, quindi quelle due impostazioni di
build diventano `CFBundleShortVersionString` e `CFBundleVersion`: gli
`Info.plist` nel repository non contengono versioni e non vanno toccati. Sono
**quattro** blocchi di configurazione (app e widget, Debug e Release) e si
muovono insieme — un widget fermo a una build precedente è un archivio
rifiutato.

## Comandi

```bash
npm run version:show           # 1.1.0 (build 2) — 1.1.0+2
npm run version:bump -- patch  # correzioni: 1.1.0 -> 1.1.1, build +1
npm run version:bump -- minor  # nuove funzioni: 1.1.0 -> 1.2.0, build +1
npm run version:bump -- major  # rotture di compatibilità: 1.1.0 -> 2.0.0, build +1
npm run version:build          # solo build +1: stesso rilascio, nuovo archivio
npm run version:set -- 2.0.0   # versione esplicita, build +1
npm run version:sync           # riscrive i derivati (dopo un merge, o a mano)
npm run version:check          # esce con 1 se qualcosa è fuori sincrono
```

Ogni comando che cambia la versione esegue anche `sync`: i file derivati
cambiano **nello stesso commit** della sorgente, o il repository si troverebbe
in uno stato in cui la versione dipende da chi ha lanciato cosa.

## Le regole, e perché

**La build non si azzera.** È un contatore monotono per tutta la vita
dell'app: `1.2.0 (7)` segue `1.1.0 (6)`. App Store Connect rifiuta un archivio
con un `CFBundleVersion` già caricato per quella versione, e azzerare a 1 a
ogni `minor` è il modo più rapido per scoprirlo a metà di un upload.

**Niente incremento automatico dentro Xcode.** La ricetta classica è una fase
di build con `agvtool`: incrementa a ogni compilazione, quindi sporca il diff
a ogni ⌘R e fa divergere la build iOS da quelle del backend e del web, che
sono lo stesso rilascio. Qui la build cambia quando lo si chiede, in un commit
che si vede.

**Il numero di build non vive in `package.json`.** npm accetta i metadati
SemVer (`1.1.0+2`), ma buona parte dell'ecosistema li tratta come parte della
versione. I tre pacchetti sono privati e nessuno li pubblica: la build sta in
`version.json` e nei due moduli generati, che è dove viene letta.

**I moduli TypeScript sono generati e versionati, non letti a runtime.** Il
backend gira come Netlify Function impacchettata da esbuild, il web come
bundle Next: in nessuno dei due `version.json` esiste sul disco al momento
della richiesta. Una costante compilata dentro il bundle non può mancare.

**`check` gira nei test.** È in `backend/__tests__/version.test.ts` e in
`frontend-web/__tests__/version.test.tsx`. Un meccanismo di sincronizzazione
solo volontario si rompe sempre allo stesso modo — qualcuno modifica il
derivato invece della sorgente — e si rompe in silenzio, perché il numero
sbagliato è comunque un numero plausibile. Così è un test rosso.

## Procedura di rilascio

1. `npm run version:bump -- minor` (o `patch` / `major`).
2. Aggiornare `CHANGELOG.md`: spostare le voci da «Non rilasciato» sotto la
   nuova versione, con data e numero di build.
3. Committare insieme `version.json`, i file derivati e il changelog.
4. `git tag -a v1.2.0 -m "1.2.0 (build 7)" && git push --tags`.
5. Deploy: Netlify (backend) e Vercel (web) partono dal merge; per iOS,
   archivio da Xcode — la versione è già quella giusta nel progetto.
6. Verificare il backend in produzione: `curl https://…/api/version` deve
   rispondere con la versione appena rilasciata. Netlify tiene in caldo la
   funzione precedente per qualche minuto, quindi è normale vedere ancora la
   vecchia subito dopo il deploy — non lo è dopo dieci minuti.

## Dove si legge, da utente

- **Web**: in fondo alla dashboard, accanto all'orario di aggiornamento.
- **iOS**: Impostazioni → App (versione e build) e in fondo alla sidebar.
- **Backend**: `GET /api/version`, e i campi `version` / `build` su
  `GET /api/health`.
