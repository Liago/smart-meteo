# Guida Step-by-Step: Setup Widget & Push Notifications in Xcode

Questa guida illustra i passaggi necessari da effettuare manualmente in Xcode per preparare il progetto iOS `smart-meteo` all'implementazione dei Widget (Fase 5D.2) e delle Notifiche Push (Fase 5D.7).

---

## 1. Setup per i Widget (Fase 5D.2)

Per poter creare e mostrare i widget nella schermata Home dell'iPhone, devi aggiungere un nuovo "Target" (un'estensione) al progetto.

### Passaggio 1.1: Aggiungere il Target Widget Extension
1. Apri il progetto `smart-meteo.xcodeproj` o `.xcworkspace` in Xcode.
2. Nella barra dei menu in alto, vai su **File > New > Target...**
3. Cerca **"Widget Extension"** (sotto la categoria iOS) e selezionalo. Clicca su **Next**.
4. Inserisci questi dettagli:
   - **Product Name:** `SmartMeteoWidget`
   - **Include Live Activity:** *Disattivato* (a meno che tu non voglia Live Activities future, in quel caso attivalo)
   - **Include Configuration App Intent:** *Disattivato* (useremo la configurazione statica per ora, basata sulla posizione corrente o preferita)
5. Clicca su **Finish**.
6. Ti verrà chiesto "Activate “SmartMeteoWidgetExtension” scheme?". Clicca su **Activate**.

### Passaggio 1.2: Configurare gli App Groups (Condivisione dati)
I widget non possono accedere direttamente alle variabili e agli stati dell'app principale. Per condividere i dati (es. l'ultima previsione meteo salvata), app e widget devono condividere un *App Group*.

1. Dalla barra di navigazione sinistra di Xcode, seleziona il progetto radice (`smart-meteo`).
2. Sotto **Targets**, seleziona il target principale `smart-meteo`.
3. Vai nel tab **Signing & Capabilities**.
4. Clicca sul pulsante **+ Capability** (in alto a sinistra nella sezione).
5. Doppio click su **App Groups**.
6. Nella nuova sezione App Groups appena aggiunta, clicca sul pulsante **+**.
7. Inserisci l'ID del gruppo: (Esempio: `group.com.tuonome.smartmeteo.shared`). Clicca OK e assicurati che la spunta sia attivata.
8. Ora ripeti la stessa cosa **per il target del widget**:
   - Sotto Targets, seleziona `SmartMeteoWidgetExtension`.
   - Vai in **Signing & Capabilities**.
   - Clicca **+ Capability** -> **App Groups**.
   - Spunta lo stesso App Group appena creato: `group.com.tuonome.smartmeteo.shared`.

*Con queste impostazioni, potremo usare `UserDefaults(suiteName: "group.com.tuonome.smartmeteo.shared")` per passare la previsione salvata dall'app al Widget.*

---

## 2. Setup per le Notifiche Push (Fase 5D.7)

Le notifiche Push richiedono certificazioni e capability specifiche che comunicano con gli Apple Push Notification service (APNs).

### Passaggio 2.1: Abilitare la Capability in Xcode
1. Seleziona il progetto `smart-meteo` nella left-bar.
2. Seleziona il target principale `smart-meteo`.
3. Vai nel tab **Signing & Capabilities**.
4. Clicca su **+ Capability**.
5. Doppio click su **Push Notifications**. (Apparirà la voce nella lista, Xcode cercherà di registrarla sul tuo Developer Account).
6. Ripeti cliccando ancora su **+ Capability**.
7. Cerca e fai doppio-click su **Background Modes**.
8. Sotto la sezione *Background Modes* appena apparsa, spunta:
   - **Background fetch**
   - **Remote notifications**

### Passaggio 2.2: Generare la Chiave per il Backend (APNs Auth Key)
Per far sì che il nostro server Node.js possa inviare le notifiche push ai dispositivi iOS, ha bisogno di una chiave privata rilasciata da Apple.

1. Accedi a [Apple Developer Portal (Certificates, Identifiers & Profiles)](https://developer.apple.com/account/resources/certificates/list).
2. Nel menu a sinistra, vai in **Keys**.
3. Clicca sul tasto **+** per creare una nuova chiave.
4. Nome chiave: *Smart Meteo Push Key* (o simile).
5. Spunta il servizio **Apple Push Notifications service (APNs)**.
6. Clicca su **Continue** e poi su **Register**.
7. Scarica il file `.p8`. **Attenzione:** puoi scaricarlo una sola volta. Conservalo al sicuro.
8. Segnati inoltre:
   - Il **Key ID** (10 caratteri, nella stessa pagina).
   - Il tuo **Team ID** (in alto a destra vicino al tuo nome utente, sempre 10 caratteri).

Questi dati (il file p8, il Key ID e il Team ID) andranno inseriti come Variabili d'Ambiente nel backend (Netlify) per autorizzare l'invio.

---

**Nota:** Avvisami una volta che hai completato questi setup su Xcode. Nel frattempo, procederò con l'implementazione del backend (Algoritmo V2 o preparativi DB).
