import type { Party, Server, Connection } from "partykit/server";
import { onConnect } from "y-partykit";

export default class LibrisSyncServer implements Server {
  constructor(readonly party: Party) {}

  async onConnect(conn: Connection) {
    // y-partykit handles all Yjs sync protocol messages automatically:
    // - Initial state sync when a client connects
    // - Incremental updates between clients
    // - Awareness (cursor presence, etc.)
    // The room name (party.id) maps to the room code (e.g., "ABCD-EF23")

    // Validate room password
    const providedPassword = new URL(conn.uri, "https://dummy").searchParams.get("password");
    const storedPassword = await this.party.storage.get<string>("room_password");

    if (storedPassword) {
      // Room has a password set - require matching password
      if (providedPassword !== storedPassword) {
        conn.close(4001, "Invalid password");
        return;
      }
    } else if (providedPassword) {
      // No password set yet, but one provided - store it
      await this.party.storage.put("room_password", providedPassword);
    }
    // If no stored password and no provided password, allow access (backward compatible)

    return onConnect(conn, this.party, {
      // Persist Y.Doc state in PartyKit's durable storage
      persist: { mode: "snapshot" },
    });
  }
}
