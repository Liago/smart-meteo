# Guida di Setup per Apple WeatherKit

Questa guida ti accompagna passo-passo nella generazione delle chiavi necessarie sull'Apple Developer Portal per abilitare il connettore **Apple WeatherKit** nel backend di Smart Meteo.

WeatherKit REST API richiede un token Bearer (JWT) per ogni chiamata. Questo token viene generato dinamicamente dal nostro backend (`backend/connectors/weatherkit.ts`) ma ha bisogno di 4 parametri fondamentali che dovrai inserire nel tuo file `backend/.env`.

---

## Prerequisiti
1. Avere un account **Apple Developer Program** a pagamento attivo.
2. Avere accesso al portale [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources).

---

## Step 1: Trovare il Team ID (`APPLE_TEAM_ID`)
1. Accedi a [developer.apple.com/account](https://developer.apple.com/account).
2. Nel menu a destra (sotto al tuo nome o sotto la sezione Membership), o scorrendo in basso nella scheda "Membership details", troverai il tuo **Team ID** (una stringa alfanumerica di 10 caratteri, es. `A1B2C3D4E5`).
3. Copialo: questo diventerà la tua variabile d'ambiente `APPLE_TEAM_ID`.

---

## Step 2: Registrare un App ID
*Se hai già un App ID registrato per Smart Meteo, puoi usare quello, ma devi assicurarti che abbia il servizio WeatherKit abilitato.*

1. Vai su **Certificates, Identifiers & Profiles** -> **Identifiers**.
2. Clicca il pulsante **+** blu per aggiungere un nuovo Identifier.
3. Seleziona **App IDs** e premi *Continue*.
4. Seleziona tipo **App** e premi *Continue*.
5. Inserisci una descrizione (es. `Smart Meteo App`) e un **Bundle ID** esplicito (es. `com.tuonome.smartmeteo`).
6. Scorri la lista delle "Capabilities", trova **WeatherKit** e spunta la casella.
7. Clicca *Continue* in alto a destra, e poi **Register**.

---

## Step 3: Registrare un Service ID (`APPLE_SERVICE_ID`)
*Nota: L'API REST di WeatherKit richiede l'uso di un Service ID, registrato separatamente dall'App ID e poi associato ad esso.*

1. Sempre in **Certificates, Identifiers & Profiles** -> **Identifiers**, cambia il filtro in alto a destra da *App IDs* a **Services IDs**.
2. Clicca il pulsante **+** blu.
3. Seleziona **Services IDs** e premi *Continue*.
4. Inserisci una descrizione (es. `Smart Meteo WeatherKit Service`) e un **Identifier** (es. `com.tuonome.smartmeteo.weatherkit` o simile allo Step 2 ma distinto, es. finendo con `.service`).
5. Copia questa stringa Identifier: questa sarà la tua variabile `APPLE_SERVICE_ID`.
6. Clicca *Continue* e poi **Register**.
7. Ora **clicca sul Service ID appena creato** nella lista.
8. Metti la spunta su **WeatherKit**, poi clicca il pulsante **Configure** che appare a fianco.
9. Nella finestra di configurazione, ti chiederà di selezionare l'App ID a cui associare questo servizio. Seleziona l'**(App ID)** che hai creato allo Step 2.
10. Salva, Continua e Salva i cambiamenti al Service ID.

---

## Step 4: Creare la WeatherKit Key (`APPLE_KEY_ID` e `APPLE_PRIVATE_KEY`)
1. Vai su **Certificates, Identifiers & Profiles** -> **Keys** (nel menu laterale a sinistra).
2. Clicca il pulsante **+** blu per creare una nuova chiave.
3. Inserisci un Key Name (es. `Smart Meteo WeatherKit Key`).
4. Sotto, spunta la capability **WeatherKit**.
5. Clicca *Continue* e poi **Register**.
6. **ATTENZIONE:** In questa pagina, fai due cose importantissime prima di andartene:
   - Copia il **Key ID** (10 caratteri) mostrato a schermo. Questa sarà la tua variabile `APPLE_KEY_ID`.
   - Clicca su **Download**. Verrà scaricato un file `.p8` (es. `AuthKey_XXXXXXXXXX.p8`). Questa è la tua chiave privata, non potrai MAI più riscaricarla da questa pagina, quindi conservala al sicuro.

---

## Step 5: Inserire i Dati nel `.env` del Backend

Ora hai tutti gli elementi. Vai nella cartella `backend` del tuo progetto e apri (o crea se non esiste) il file `.env`. (Modifica anche `.env.example` o il posto dove tieni salvate le chiavi se usi un secret manager).

Apri il file `.p8` scaricato (con TextEdit, VS Code o un qualsiasi editor di testo semplice). Vedrai un testo che inizia con `-----BEGIN PRIVATE KEY-----` e finisce con `-----END PRIVATE KEY-----`.

Aggiungi (o aggiorna) queste righe nel tuo file `.env` nel backend:

```env
# Apple WeatherKit Configuration
APPLE_TEAM_ID="IlTuoTeamID_Da_Step1"
APPLE_SERVICE_ID="IlTuoServiceID_Da_Step3"
APPLE_KEY_ID="IlKeyID_Da_Step4"

# La chiave privata va messa su UNA SOLA RIGA usando \n come separatore per gli a capo.
# Sostituisci "..." con tutto il blocco alfanumerico contenuto tra BEGIN ed END.
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

> **Suggerimento per `APPLE_PRIVATE_KEY`:** 
> Per convertirla facilmente su un'unica riga per il file `.env`, sostituisci tutti gli "a capo" (invisibili) nel file copiato con la stringa letterale `\n`. Il nostro backend capirà come rimpiazzarli correttamente per l'algoritmo grazie alla riga `privateKey.replace(/\\n/g, '\n')` implementata in `weatherkit.ts`.

---

## Step 6: Testare

1. Dal terminale di VS Code nella root del progetto:
   ```bash
   cd backend
   npm run dev:backend
   ```
2. Ora l'integrazione è accesa. Prova a chiamare l'API da terminale per forzare il fetch su Apple e verificare i log (assicurati di mettere coordinate diverse dalle precedenti in modo da evitare la Cache-Hit del database!).
   ```bash
   curl "http://localhost:3000/api/forecast?lat=45.4642&lon=9.1900"
   ```
3. Nel terminale dove hai avviato il backend dovresti vedere il log "Received 8 valid forecasts from: ... apple_weatherkit, ...". Se vedi questo, l'integrazione è conclusa con successo e il fetch Apple è live!
