import { matchMaker, type IRoomCache } from 'colyseus';
import type { RoomLifecycle } from '@truco/contracts';

export interface TrucoRoomMetadata {
  currentClients: number;
  joinable: boolean;
  lifecycle: RoomLifecycle;
  roomCode: string;
}

export interface RoomDirectoryEntry extends TrucoRoomMetadata {
  roomId: string;
}

const TRUCO_ROOM_NAME = 'truco_room';

function isRoomLifecycle(value: unknown): value is RoomLifecycle {
  return (
    value === 'OPEN' ||
    value === 'LOCKED' ||
    value === 'PAUSED_RECONNECT' ||
    value === 'CLOSED'
  );
}

function toRoomDirectoryEntry(
  room: IRoomCache<Partial<TrucoRoomMetadata>>,
): RoomDirectoryEntry | null {
  const metadata = room.metadata ?? {};
  const roomCode = metadata.roomCode;

  if (typeof roomCode !== 'string' || roomCode.length === 0) {
    return null;
  }

  const joinable =
    typeof metadata.joinable === 'boolean'
      ? metadata.joinable
      : room.locked !== true;
  const lifecycle = isRoomLifecycle(metadata.lifecycle)
    ? metadata.lifecycle
    : joinable
      ? 'OPEN'
      : 'LOCKED';
  const currentClients =
    typeof metadata.currentClients === 'number'
      ? metadata.currentClients
      : room.clients;

  return {
    currentClients,
    joinable,
    lifecycle,
    roomCode,
    roomId: room.roomId,
  };
}

export async function listTrucoRooms(): Promise<RoomDirectoryEntry[]> {
  const rooms = (await matchMaker.query({
    name: TRUCO_ROOM_NAME,
  })) as IRoomCache<Partial<TrucoRoomMetadata>>[];

  return rooms
    .map((room) => toRoomDirectoryEntry(room))
    .filter((room): room is RoomDirectoryEntry => room !== null);
}

export async function findTrucoRoomByCode(
  roomCode: string,
): Promise<RoomDirectoryEntry | null> {
  const normalizedRoomCode = roomCode.trim().toUpperCase();
  if (!normalizedRoomCode) {
    return null;
  }

  const rooms = await listTrucoRooms();
  return rooms.find((room) => room.roomCode === normalizedRoomCode) ?? null;
}
