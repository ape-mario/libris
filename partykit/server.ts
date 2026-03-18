import type { Party, Server, Connection } from "partykit/server";
import { onConnect } from "y-partykit";

export default class LibrisSyncServer implements Server {
  constructor(readonly party: Party) {}

  onConnect(conn: Connection) {
    // y-partykit handles all Yjs sync protocol messages automatically:
    // - Initial state sync when a client connects
    // - Incremental updates between clients
    // - Awareness (cursor presence, etc.)
    // The room name (party.id) maps to the room code (e.g., "ABCD-EF23")
    return onConnect(conn, this.party, {
      // Persist Y.Doc state in PartyKit's durable storage
      persist: { mode: "snapshot" },
    });
  }
}
