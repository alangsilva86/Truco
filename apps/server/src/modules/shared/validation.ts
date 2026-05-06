const MAX_NICKNAME_LENGTH = 24;
const MIN_NICKNAME_LENGTH = 2;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizeNickname(rawNickname: unknown): string {
  if (typeof rawNickname !== 'string') {
    return '';
  }

  return collapseWhitespace(rawNickname.replace(/[<>]/g, '')).slice(
    0,
    MAX_NICKNAME_LENGTH,
  );
}

export function assertValidNickname(rawNickname: unknown): string {
  const nickname = sanitizeNickname(rawNickname);

  if (nickname.length < MIN_NICKNAME_LENGTH) {
    throw new Error('O apelido precisa ter entre 2 e 24 caracteres.');
  }

  return nickname;
}

export function normalizeRoomCode(rawRoomCode: unknown): string {
  return String(rawRoomCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}
