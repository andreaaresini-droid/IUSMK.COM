# Design — Notifiche push native (FCM) per l'app IUSMK

Data: 2026-06-19
Stato: approvato (design), in attesa di piano di implementazione

## Obiettivo

Aggiungere le **notifiche push native** all'app IUSMK (Capacitor) riusando i flussi di
notifica già esistenti. Quando un admin invia una notifica/broadcast, deve arrivare come
push reale anche sull'app nativa (Android subito, iOS nella fase build iOS cloud), oltre
ai browser come avviene oggi. Motivazione secondaria: una vera feature nativa riduce il
rischio di reject Apple regola 4.2 ("minimum functionality").

## Contesto esistente

- **Frontend** `artifacts/barber-artist` (Vite+React SPA, Capacitor 8): hook
  `src/hooks/use-push-notifications.ts` gestisce la sottoscrizione web-push
  (service worker `public/sw.js` + `pushManager` + VAPID). Endpoint usati:
  `/admin/push/*` e `/customer/push/*` (`/push/subscribe`, `/push/vapid-public-key`).
  In contesto nativo Capacitor `serviceWorker`/`PushManager` **non funzionano** → l'hook
  cade su stato `"unsupported"`.
- **Backend** `artifacts/api-server`: `src/lib/webPush.ts` invia con `web-push` (VAPID)
  leggendo da `pushSubscriptionsTable`; funzioni `sendPushToUser/Users/Admin/All`.
  `src/lib/notifications.ts` orchestra la creazione delle notifiche e gli invii.
- Le due app sono deployate come progetti Vercel separati (vedi memoria architettura).

## Gap

Il nativo richiede **FCM (Android) + APNs (iOS)** tramite `@capacitor/push-notifications`:
token e protocollo d'invio diversi da web-push. Serve un secondo canale d'invio (FCM) e
uno storage separato dei token nativi.

## Architettura

Un solo trigger applicativo → fan-out su due canali.

```
  Admin invia notifica/broadcast
        │
        ▼
  Backend: persiste la notifica (come oggi)
        │  notifyUser(payload)  ← NUOVA funzione unificata
        ├──► web-push (VAPID, esistente)   → browser
        └──► FCM (firebase-admin, NUOVO)   → app nativa
                                              ├─ Android: FCM diretto
                                              └─ iOS: FCM → APNs
```

### Componenti nuovi

1. **Progetto Firebase "IUSMK"** (piano gratuito):
   - App Android `com.iusmk.app` → `google-services.json`.
   - Service-account key (JSON segreto) per il backend.
   - (iOS, fase successiva) app iOS + chiave APNs caricata su Firebase + `GoogleService-Info.plist`.

2. **Frontend**:
   - Dipendenza `@capacitor/push-notifications`.
   - `use-push-notifications.ts` si dirama su `Capacitor.isNativePlatform()`:
     - **nativo** → flusso FCM: `PushNotifications.requestPermissions()`,
       `register()`, evento `registration` → token FCM → POST al nuovo endpoint
       `/{role}/push/native-token`; eventi `pushNotificationReceived` e
       `pushNotificationActionPerformed` → naviga a `/notifications/:id`.
     - **browser** → flusso web-push attuale, **invariato**.

3. **Backend**:
   - Nuova tabella `nativePushTokensTable`: `token` (univoco), `userId`, `role`,
     `platform` (`android`/`ios`), `active`, `userAgent?`, `updatedAt`.
   - Nuovi endpoint speculari ai web: `POST /customer/push/native-token`,
     `POST /admin/push/native-token`, `DELETE .../native-token`.
   - Nuovo sender `src/lib/fcmPush.ts` con `firebase-admin`, funzioni
     `sendFcmToUser/Users/Admin` analoghe a `webPush.ts`; su errore
     `messaging/registration-token-not-registered` marca il token `active=false`.
   - Funzione unificata `notifyUser(payload)` (e varianti `notifyUsers`, `notifyAdmin`)
     che chiama **sia** web-push **sia** FCM. I call-site attuali in
     `notifications.ts`/route admin che usano `sendPushTo*` vengono spostati su queste
     funzioni unificate. Nessuna modifica alla logica di business.

### Configurazione e segreti

- `google-services.json` → `artifacts/barber-artist/android/app/` (config client, non
  segreto critico: committato nel repo privato; il `build.gradle` ha già l'hook che
  applica `com.google.gms.google-services` se il file esiste).
- Service-account key → **mai** nel repo. Variabile d'ambiente Vercel
  `FIREBASE_SERVICE_ACCOUNT` (JSON in base64), letta dal backend all'init di `firebase-admin`.
- `versionCode` Android: **1 → 2** per la nuova build con push.

### Dati / flusso

1. App avviata (utente loggato) → registrazione nativa → token FCM → backend salva con
   `userId`/`role`/`platform`.
2. Admin invia notifica/broadcast → backend persiste (esistente) → `notifyUser` → web-push
   + FCM partono insieme.
3. Dispositivo riceve push FCM → l'OS mostra la notifica → tap → app apre `/notifications/:id`.
4. Token morto → marcato inattivo al primo invio fallito.

## iOS (fase successiva, non bloccante ora)

Stesso codice frontend. Da fare nella fase iOS cloud build: aggiungere
`GoogleService-Info.plist` al progetto iOS, abilitare capability Push Notifications negli
entitlements, generare e caricare la chiave APNs su Firebase. Account Apple Developer già
attivo.

## Testing

- **Backend**: test unitari di `fcmPush.ts` con `firebase-admin` mockato (invio ok, token
  morto → marcato inattivo, lista vuota → no-op). Test che `notifyUser` invochi entrambi i
  canali.
- **Manuale (Android)**: build nativa con `versionCode 2` → install su device → app registra
  il token → da pannello admin invio notifica → arriva sul telefono → tap → apre il dettaglio.

## Cosa deve fare l'utente (guidato)

1. Creare il progetto Firebase "IUSMK" (gratis), aggiungere l'app Android `com.iusmk.app`,
   scaricare `google-services.json`.
2. Generare la service-account key (JSON) e fornirla per impostarla su Vercel.
3. Confermare/impostare la env var `FIREBASE_SERVICE_ACCOUNT` su Vercel.

## Out of scope (YAGNI)

- iOS APNs (rimandato alla fase iOS, stesso codice).
- Segmentazione avanzata / topic FCM / notifiche schedulate: non servono ora.
- Statistiche di consegna oltre il logging già presente.
```
