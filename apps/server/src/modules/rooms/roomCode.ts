const ROOM_CODE_CHARS = 'ACDEFGHJKMNPQRTUVWXY34679';
const ROOM_CODE_LENGTH = 6;

export async function generateRoomCode(
  exists: (roomCode: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let roomCode = '';
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      roomCode +=
        ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }

    if (!(await exists(roomCode))) {
      return roomCode;
    }
  }

  throw new Error('Nao foi possivel gerar um codigo de sala unico.');
}
