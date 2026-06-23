import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * Registra automaticamente le notifiche push per il cliente loggato.
 *
 * Problema risolto: prima il token FCM/permesso veniva richiesto SOLO quando il
 * cliente apriva la pagina Notifiche e premeva "Attiva push". Risultato: il popup
 * del permesso non compariva all'avvio e, se non si toccava il toggle, il token
 * non veniva mai registrato → nessuna notifica (Android e iPhone).
 *
 * Ora, nell'app nativa, appena un cliente/studente è loggato:
 *  - se il permesso è già concesso → il hook registra subito il token (nessun popup);
 *  - se il permesso non è ancora stato deciso → chiediamo il permesso (popup) e,
 *    al consenso, registriamo il token.
 *
 * Sul web NON forziamo il prompt (cattiva UX/penalità browser): resta il toggle
 * manuale nella pagina Notifiche.
 */
function PushRegistrar() {
  const { status, subscribe } = usePushNotifications("customer");
  const tried = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;   // solo app nativa
    if (tried.current) return;
    // "unsubscribed" = permesso non ancora concesso (stato "prompt").
    // "subscribed"/"denied" non richiedono azione: subscribed registra già il token,
    // denied non va forzato.
    if (status === "unsubscribed") {
      tried.current = true;
      void subscribe();
    }
  }, [status, subscribe]);

  return null;
}

export function PushAutoRegister() {
  const { data: user } = useCurrentUser();
  const isCustomer = !!user && (user.role === "customer" || user.role === "student");
  // Monta il hook (e quindi la registrazione del token) solo per clienti/studenti loggati.
  if (!isCustomer) return null;
  return <PushRegistrar />;
}
