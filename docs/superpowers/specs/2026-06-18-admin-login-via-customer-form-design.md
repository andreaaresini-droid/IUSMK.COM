# Design — Accesso admin tramite il form di login dei clienti

**Data:** 2026-06-18
**Stato:** Approvato
**Approccio scelto:** A (login "intelligente" lato frontend, backend invariato)

## Obiettivo

Rimuovere il pulsante in fondo alla home che porta al pannello admin. L'admin
deve poter accedere alla dashboard usando le **attuali credenziali (username +
password)** attraverso lo **stesso form di login usato dai clienti** (`/login`),
venendo poi reindirizzato a `/admin/dashboard`.

## Contesto attuale

- `/login` (`pages/login.tsx`) — form clienti, campo **email** (`type="email"`,
  required) + password. Usa `useCustomerLogin` → `POST /auth/customer/login` →
  redirect a `/`.
- `/admin` (`pages/admin/login.tsx`) — form admin, **username** + password. Usa
  `useAdminLogin` → `POST /auth/admin/login` → redirect a `/admin/dashboard`.
- Tabella `admins`: ha sia `username` (unique) sia `email` (unique). L'admin
  accede oggi con lo **username**.
- Il link al pannello admin è nel `Footer` (`components/layout/Footer.tsx`,
  blocco "Pannello Admin", righe ~98-107) e punta a `/admin`.
- Token salvato in `localStorage["barber_artist_token"]`; ruolo letto da
  `GET /auth/me` (`useCurrentUser`).

## Modifiche

### 1. Footer (`components/layout/Footer.tsx`)
Rimuovere il blocco "Pannello Admin" (il `<div>` con `<p>{f.adminPanel}</p>` e il
`<Link href="/admin">`). Nessun'altra modifica.

### 2. Nuovo hook `useUniversalLogin` (`hooks/use-auth.ts`)
Hook unico che gestisce il fallback cliente→admin:
1. Prova `POST /auth/customer/login` con `{ email: identifier, password }`.
2. Se fallisce (qualsiasi errore), prova `POST /auth/admin/login` con
   `{ username: identifier, password }`.
3. Al primo successo: salva il token in `localStorage`, aggiorna la cache
   `["current-user"]` con `data.user`, e reindirizza in base al ruolo:
   - `admin` → `/admin/dashboard`
   - `customer` / `student` → `checkout_redirect` se presente, altrimenti `/`
4. Toast: **un solo** toast di successo; **un solo** toast d'errore
   ("Credenziali non valide") mostrato solo se falliscono **entrambi** i
   tentativi.

Implementazione: usa `fetchApi(..., false)` (no redirect automatico su 401) per
entrambe le chiamate, dentro un `try/catch` sequenziale, così non scattano i
toast degli hook esistenti.

Gli hook esistenti `useCustomerLogin` e `useAdminLogin` restano **invariati**
(ancora usati da altre pagine): non vengono toccati per evitare doppi toast.

### 3. Pagina login (`pages/login.tsx`)
- Sostituire `useCustomerLogin` con `useUniversalLogin`.
- Campo identificativo: `type="text"`, etichetta "Email o username",
  `autoComplete="username"`, placeholder aggiornato; rimuovere la validazione di
  formato email (mantenere `required`). I clienti continuano a inserire l'email
  senza problemi.
- L'effetto "già loggato" (redirect se `useCurrentUser` ritorna un utente)
  gestisce anche il ruolo `admin` → `/admin/dashboard`.
- `handleSubmit` invia `{ identifier, password }`. La normalizzazione
  (`trim().toLowerCase()`) avviene **una sola volta** dentro `useUniversalLogin`
  e vale per entrambi i tentativi — coerente col comportamento attuale: il login
  cliente già fa lowercase dell'email, e il login admin fa lowercase dello
  username lato backend (`usernameLower`).

## Cosa NON cambia (rete di sicurezza)

- **Backend di autenticazione: intatto.** Nessuna modifica a `auth.ts`.
- La route `/admin` e il form `AdminLogin` restano raggiungibili via URL diretto
  (solo rimossi dal footer).

## Casi limite / decisioni

- Se il login cliente fallisce per errore server (es. 500) e non solo per
  credenziali, si prova comunque l'admin; se anche quello fallisce si mostra il
  messaggio d'errore restituito. Accettabile.
- Collisione email-cliente == username-admin: praticamente impossibile (le email
  contengono `@`). Non gestita esplicitamente.

## Verifica (manuale, post-deploy)

Il build/test locale non è eseguibile (node_modules corrotto: mancano binari
nativi `rollup`/`tsc`). Verifica manuale dopo il deploy Vercel:
1. Cliente con email + password → atterra su `/`.
2. Admin con username + password → atterra su `/admin/dashboard`.
3. Credenziali errate → toast "Credenziali non valide", nessun redirect.
4. Footer della home: il link "Pannello Admin" non è più presente.
