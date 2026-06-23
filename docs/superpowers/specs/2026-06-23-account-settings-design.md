# Sezione "Account / Impostazioni" cliente — Design

**Data:** 2026-06-23
**Contesto:** Apple ha rifiutato la review dell'app IUSMK (iOS) perché manca la possibilità per il
cliente di **eliminare il proprio account in autonomia dall'app** (linea guida App Store 5.1.1(v)).
La pagina `/delete-account` esistente è solo informativa ("scrivi una mail per richiedere la
cancellazione"): non soddisfa il requisito, che impone di poter **avviare e completare**
l'eliminazione dentro l'app.

## Obiettivo

Aggiungere una pagina **Account** raggiungibile dal menu cliente con:
1. modifica nome e cognome;
2. cambio password (password attuale + nuova);
3. **eliminazione account self-service reale**, con conferma tramite password.

Email **non** modificabile (è l'identificativo di login, univoco, e usato dalla sync Supabase).
Nessun job programmato: l'eliminazione è immediata.

## Stato attuale (rilevato)

- Account cliente in `studentsTable` (`lib/db/src/schema/students.ts`): `id, name, firstName,
  lastName, email, passwordHash, role, ...`.
- Auth cliente via JWT + fallback Supabase (`requireCustomerAuth` in
  `artifacts/api-server/src/middlewares/authMiddleware.ts`).
- Helper password: `hashPassword`, `comparePassword` (async) in `artifacts/api-server/src/lib/auth.ts`.
- Rotte cliente in `artifacts/api-server/src/routes/customer.ts` (nessun endpoint profilo/eliminazione).
- Menu cliente in `artifacts/barber-artist/src/components/layout/Navbar.tsx` (`CustomerMenu` desktop +
  blocco mobile): voci Notifiche, I miei corsi, Messaggi, Logout.
- Client API: `artifacts/barber-artist/src/lib/api-client.ts` (`fetchApi`), token in
  `localStorage["barber_artist_token"]`.
- Hook auth: `artifacts/barber-artist/src/hooks/use-auth.ts` (`useCurrentUser`, `useLogout`).
- `db` è un'istanza drizzle node-postgres → `db.transaction(...)` disponibile.

## Architettura

### Frontend — pagina `/account` (`artifacts/barber-artist/src/pages/account.tsx`)

Pagina protetta: se `useCurrentUser()` non restituisce un cliente (`customer`/`student`) →
redirect `/login`. Layout coerente con il sito (Navbar + Footer, tema scuro). Tre sezioni in card:

- **Profilo**: input Nome e Cognome precompilati; Email read-only con nota "Per cambiare email
  contatta l'assistenza". Bottone "Salva modifiche".
- **Password** (mostrata solo se `hasPassword === true`): password attuale, nuova, conferma nuova.
  Validazione: nuova ≥ 6 caratteri (coerente col resto del sistema), nuova === conferma.
- **Elimina account** (zona "danger" rossa): testo che spiega cosa viene eliminato e cosa
  conservato; bottone "Elimina il mio account" → apre dialog di conferma con:
  - campo password (se `hasPassword`), altrimenti solo conferma esplicita;
  - bottone finale "Elimina definitivamente".
  Al successo: rimozione token, `queryClient.clear()`, redirect a `/` (home) con toast di conferma.

Hook nuovi in `use-auth.ts` (o file dedicato `use-account.ts`): `useCustomerProfile` (GET),
`useUpdateProfile` (PUT), `useChangePassword` (PUT), `useDeleteAccount` (DELETE).

### Routing — `artifacts/barber-artist/src/App.tsx`

Aggiungere `const Account = lazy(() => import("@/pages/account"))` e
`<Route path="/account" component={Account} />`.

### Menu — `Navbar.tsx`

Aggiungere voce "Account" (icona `Settings`/`User` da lucide-react) in:
- `CustomerMenu` (desktop), sopra il divisore del Logout;
- blocco mobile cliente, sopra il bottone Logout.

### Backend — nuovi endpoint in `customer.ts` (tutti `requireCustomerAuth`)

- `GET /api/customer/profile` → `{ firstName, lastName, email, hasPassword }`.
  `hasPassword = !!student.passwordHash && passwordHash !== "supabase-managed"`.
- `PUT /api/customer/profile` body `{ firstName, lastName }` → valida non vuoti, aggiorna
  `firstName`, `lastName` e ricalcola `name = "firstName lastName"`, `updatedAt`. Ritorna il profilo.
- `PUT /api/customer/password` body `{ currentPassword, newPassword }` → richiede `hasPassword`;
  verifica `currentPassword` con `comparePassword`; valida `newPassword` ≥ 6; salva nuovo hash.
  Se l'account non ha password propria (Supabase) → 400 con messaggio esplicativo.
- `DELETE /api/customer/account` body `{ password? }` → se `hasPassword`, verifica `password`
  con `comparePassword` (401 se errata); poi esegue l'eliminazione in transazione (sotto).

### Logica di eliminazione (transazione `db.transaction`)

Ordine rispettoso dei vincoli FK rilevati (alcuni FK verso `students` **non** hanno
`onDelete: cascade`):

Eliminazioni (righe del cliente):
1. `chat_conversations` WHERE `userId` (i `chat_messages` cascadano via `conversationId`).
2. `device_sessions` WHERE `userId`.
3. `student_course_access` WHERE `studentId`.
4. `video_progress` WHERE `studentId`.
5. `notifications` WHERE `userId`.
6. `native_push_tokens` WHERE `userId`.
7. `push_subscriptions` WHERE `userId`.
8. `password_reset_tokens` WHERE `userId` (ridondante: cascade, ma esplicito per chiarezza).
9. `video_disclaimer_acks` WHERE `studentId` (ridondante: cascade).

Scollegamenti (conservati per legge/fiscale, come da pagina legale ~10 anni):
10. `course_purchases` SET `userId = NULL` WHERE `userId` (mantiene record fiscale; `customerEmail`
    resta sul record).
11. `access_codes` SET `boundUserId = NULL` WHERE `boundUserId` (i codici restano asset admin).

Infine:
12. `students` DELETE WHERE `id`.

Tutto dentro una singola transazione: se un passo fallisce, rollback completo e 500.

### Pagina legale `/delete-account`

Aggiornare il testo: l'eliminazione ora si effettua **in-app** da *Account → Elimina account*;
l'email `iusmkbarber@gmail.com` resta come canale alternativo. La pagina resta pubblica (utile
anche per lo store URL).

## Error handling

- Tutti gli endpoint: try/catch con `req.log.error` e risposta JSON `{ error, message }` coerente
  con lo stile esistente.
- Validazioni input lato server (non fidarsi del client).
- Frontend: toast di errore/successo (pattern `use-toast` già in uso).

## Testing / verifica

- Build TypeScript di `api-server` e `barber-artist` senza errori.
- Verifica manuale del flusso: login cliente → Account → modifica nome → cambio password →
  eliminazione con password → logout automatico e impossibilità di ri-login.
- Controllo che un account con corsi attivi e acquisti venga eliminato senza violazioni FK e che
  il record `course_purchases` resti con `userId = NULL`.

## Fuori scope (YAGNI)

- Cambio email.
- Periodo di grazia / cancellazione differita / job programmati.
- Esportazione dati (non richiesta da Apple per questo caso).
