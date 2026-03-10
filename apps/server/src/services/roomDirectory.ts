import { RoomLifecycle } from '@truco/contracts';

export interface RoomDirectoryEntry {
  roomId: string;
  roomCode: string;
  joinable: boolean;
  lifecycle: RoomLifecycle;
  currentClients: number;
}

export interface RoomDirectoryStore {
  delete(roomCode: string): void;
  get(roomCode: string): RoomDirectoryEntry | null;
  list(): RoomDirectoryEntry[];
  set(roomCode: string, entry: RoomDirectoryEntry): void;
}

class InMemoryRoomDirectoryStore implements RoomDirectoryStore {
  private readonly entries = new Map<string, RoomDirectoryEntry>();

  delete(roomCode: string): void {
    this.entries.delete(roomCode);
  }

  get(roomCode: string): RoomDirectoryEntry | null {
    return this.entries.get(roomCode) ?? null;
  }

  list(): RoomDirectoryEntry[] {
    return [...this.entries.values()];
  }

  set(roomCode: string, entry: RoomDirectoryEntry): void {
    this.entries.set(roomCode, entry);
  }
}

class RoomDirectory {
  constructor(
    private readonly store: RoomDirectoryStore = new InMemoryRoomDirectoryStore(),
  ) {}

  list(): RoomDirectoryEntry[] {
    return this.store.list();
  }

  register(roomId: string, roomCode: string): void {
    this.store.set(roomCode, {
      roomId,
      roomCode,
      joinable: true,
      lifecycle: 'OPEN',
      currentClients: 0,
    });
  }

  update(roomCode: string, patch: Partial<RoomDirectoryEntry>): void {
    const entry = this.store.get(roomCode);
    if (!entry) {
      return;
    }

    this.store.set(roomCode, {
      ...entry,
      ...patch,
    });
  }

  resolve(roomCode: string): RoomDirectoryEntry | null {
    return this.store.get(roomCode);
  }

  unregister(roomCode: string): void {
    this.store.delete(roomCode);
  }
}

// This service is intentionally store-backed so a shared implementation
// can replace the in-memory store when the app scales beyond one instance.
export const roomDirectory = new RoomDirectory();
