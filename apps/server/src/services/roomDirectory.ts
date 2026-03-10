import { RoomLifecycle } from '@truco/contracts';

interface RoomDirectoryEntry {
  roomId: string;
  roomCode: string;
  joinable: boolean;
  lifecycle: RoomLifecycle;
  currentClients: number;
}

class RoomDirectory {
  private readonly entries = new Map<string, RoomDirectoryEntry>();

  register(roomId: string, roomCode: string): void {
    this.entries.set(roomCode, {
      roomId,
      roomCode,
      joinable: true,
      lifecycle: 'OPEN',
      currentClients: 0,
    });
  }

  update(roomCode: string, patch: Partial<RoomDirectoryEntry>): void {
    const entry = this.entries.get(roomCode);
    if (!entry) {
      return;
    }

    this.entries.set(roomCode, {
      ...entry,
      ...patch,
    });
  }

  resolve(roomCode: string): RoomDirectoryEntry | null {
    return this.entries.get(roomCode) ?? null;
  }

  unregister(roomCode: string): void {
    this.entries.delete(roomCode);
  }
}

export const roomDirectory = new RoomDirectory();
