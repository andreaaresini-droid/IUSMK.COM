import { EventEmitter } from "events";

export const contactEvents = new EventEmitter();
contactEvents.setMaxListeners(100);

const sseClients = new Set<any>();

export function registerSseClient(res: any) {
  sseClients.add(res);
}

export function unregisterSseClient(res: any) {
  sseClients.delete(res);
}

export function broadcastNewContact(contact: { id: number; name: string; subject: string }) {
  const data = JSON.stringify({ type: "new_contact", contact });
  for (const client of sseClients) {
    try { client.write(`data: ${data}\n\n`); } catch { sseClients.delete(client); }
  }
}
