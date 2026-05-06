import { matchMaker } from 'colyseus';
import type {
  CreateRoomResponse,
  GuestUserResponse,
  JoinRoomResponse,
  PublicRoom,
  RoomLookupFailureReason,
  RoomLookupResponse,
  RoomListResponse,
  RoomStatus,
  UserProfile,
} from '@truco/contracts';
import { ApiError } from '../http/apiError.js';
import { isDatabaseConfigured } from '../../db/prisma.js';
import { logger } from '../../observability/logger.js';
import { userRepository } from '../users/user.repository.js';
import { roomRepository, type RoomWithParticipants } from './room.repository.js';
import { generateRoomCode } from './roomCode.js';
import { assertValidNickname, normalizeRoomCode } from '../shared/validation.js';

const ROOM_NAME = 'truco_room';
const SUPPORTED_MAX_PLAYERS = 2;

interface CreateRoomInput {
  maxPlayers?: number;
  nickname: string;
  ownerUserId: string;
  requestOrigin?: string;
}

interface JoinRoomInput {
  nickname: string;
  roomCode: string;
  userId: string;
}

interface RealtimeJoinAuthorizationInput {
  assignedTeamId: number;
  nickname: string;
  persistentRoomId: string;
  roomCode: string;
  sessionId: string;
  userId: string;
}

interface RealtimeJoinAuthorization {
  nickname: string;
  roomCode: string;
  teamId: 0 | 1;
  userId: string;
}

function ensureDatabaseReady(): void {
  if (!isDatabaseConfigured()) {
    throw new ApiError(503, {
      error: 'DATABASE_UNAVAILABLE',
      message:
        'O banco de dados ainda nao foi configurado neste ambiente.',
    });
  }
}

function toUserProfile(user: {
  avatarUrl: string | null;
  id: string;
  isGuest: boolean;
  nickname: string;
}): UserProfile {
  return {
    avatarUrl: user.avatarUrl,
    id: user.id,
    isGuest: user.isGuest,
    nickname: user.nickname,
  };
}

function getJoinFailureMessage(reason: RoomLookupFailureReason): string {
  switch (reason) {
    case 'ROOM_NOT_FOUND':
      return 'Nao encontramos essa sala. Confira o codigo ou peca um novo link para quem criou a sala.';
    case 'ROOM_FULL':
      return 'Essa sala ja esta cheia. Peca para criarem uma nova sala ou aguarde uma vaga.';
    case 'ROOM_ALREADY_STARTED':
      return 'Essa partida ja comecou. No momento, nao e possivel entrar como jogador.';
    case 'ROOM_FINISHED':
      return 'Essa sala ja foi finalizada.';
    case 'ROOM_UNAVAILABLE':
    default:
      return 'Essa sala esta indisponivel no momento. Tente novamente em alguns instantes.';
  }
}

function countActiveParticipants(room: RoomWithParticipants): number {
  return room.participants.filter((participant) =>
    participant.status === 'joined' || participant.status === 'disconnected',
  ).length;
}

function findParticipant(room: RoomWithParticipants, userId: string) {
  return room.participants.find(
    (participant) => participant.userId === userId && participant.status !== 'left',
  );
}

function evaluateRoomJoin(
  room: RoomWithParticipants,
  userId?: string,
): {
  canJoin: boolean;
  reason: RoomLookupFailureReason | null;
} {
  const participant = userId ? findParticipant(room, userId) : null;
  const isExistingParticipant = Boolean(participant);
  const activePlayers = countActiveParticipants(room);

  if (room.status === 'finished') {
    return { canJoin: false, reason: 'ROOM_FINISHED' };
  }

  if (room.status === 'abandoned') {
    return { canJoin: false, reason: 'ROOM_UNAVAILABLE' };
  }

  if (room.status === 'playing' && !isExistingParticipant) {
    return { canJoin: false, reason: 'ROOM_ALREADY_STARTED' };
  }

  if (activePlayers >= room.maxPlayers && !isExistingParticipant) {
    return { canJoin: false, reason: 'ROOM_FULL' };
  }

  if (!room.colyseusRoomId && room.status !== 'waiting') {
    return { canJoin: false, reason: 'ROOM_UNAVAILABLE' };
  }

  return { canJoin: true, reason: null };
}

function toPublicRoom(
  room: RoomWithParticipants,
  userId?: string,
): PublicRoom {
  const activePlayers = countActiveParticipants(room);
  const genericJoinAllowed =
    room.status === 'waiting' && activePlayers < room.maxPlayers;
  const participant = userId ? findParticipant(room, userId) : null;

  return {
    canJoin:
      genericJoinAllowed ||
      Boolean(
        participant && (room.status === 'waiting' || room.status === 'playing'),
      ),
    createdAt: room.createdAt.toISOString(),
    id: room.id,
    maxPlayers: room.maxPlayers,
    ownerUserId: room.ownerUserId,
    players: activePlayers,
    roomCode: room.roomCode,
    status: room.status as RoomStatus,
  };
}

function resolveMaxPlayers(rawMaxPlayers?: number): number {
  if (rawMaxPlayers === undefined || rawMaxPlayers === null) {
    return SUPPORTED_MAX_PLAYERS;
  }

  if (rawMaxPlayers !== SUPPORTED_MAX_PLAYERS) {
    throw new ApiError(400, {
      error: 'VALIDATION_ERROR',
      message:
        'Nesta fase, as salas suportam exatamente 2 jogadores controlando as duplas.',
    });
  }

  return rawMaxPlayers;
}

function resolvePublicWebUrl(requestOrigin?: string): string {
  const configured = String(process.env.PUBLIC_WEB_URL ?? '').trim();
  if (configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  if (requestOrigin && /^https?:\/\//i.test(requestOrigin)) {
    return requestOrigin.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

async function findLiveRoomById(roomId: string) {
  try {
    return await matchMaker.getRoomById(roomId);
  } catch {
    return null;
  }
}

async function ensureRealtimeRoom(room: RoomWithParticipants): Promise<{
  roomId: string;
  roomName: 'truco_room';
}> {
  if (room.colyseusRoomId) {
    const liveRoom = await findLiveRoomById(room.colyseusRoomId);
    if (liveRoom) {
      return {
        roomId: liveRoom.roomId,
        roomName: ROOM_NAME,
      };
    }
  }

  if (room.status !== 'waiting') {
    throw new ApiError(409, {
      message: getJoinFailureMessage('ROOM_UNAVAILABLE'),
      ok: false,
      reason: 'ROOM_UNAVAILABLE',
    });
  }

  const liveRoom = await matchMaker.createRoom(ROOM_NAME, {
    maxPlayers: room.maxPlayers,
    persistentRoomId: room.id,
    roomCode: room.roomCode,
  });

  await roomRepository.setColyseusRoomId(room.id, liveRoom.roomId);
  logger.info('room.realtime.created', {
    colyseusRoomId: liveRoom.roomId,
    roomCode: room.roomCode,
    roomId: room.id,
  });

  return {
    roomId: liveRoom.roomId,
    roomName: ROOM_NAME,
  };
}

function nextAvailableTeamId(room: RoomWithParticipants): 0 | 1 | null {
  const takenTeams = new Set(
    room.participants
      .filter((participant) => participant.status !== 'left')
      .map((participant) => participant.team)
      .filter((team): team is number => typeof team === 'number'),
  );

  if (!takenTeams.has(0)) {
    return 0;
  }

  if (!takenTeams.has(1)) {
    return 1;
  }

  return null;
}

export class RoomService {
  async createGuestUser(input: {
    avatarUrl?: string | null;
    nickname: unknown;
    userId?: string;
  }): Promise<GuestUserResponse> {
    ensureDatabaseReady();

    const nickname = assertValidNickname(input.nickname);
    const user = await userRepository.upsertGuestUser({
      avatarUrl: input.avatarUrl ?? null,
      nickname,
      userId: input.userId,
    });

    logger.info('user.guest.upserted', {
      isUpdate: Boolean(input.userId),
      userId: user.id,
    });

    return {
      ok: true,
      user: toUserProfile(user),
    };
  }

  async getUser(userId: string): Promise<GuestUserResponse> {
    ensureDatabaseReady();

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, {
        error: 'USER_NOT_FOUND',
        message: 'Usuario nao encontrado.',
      });
    }

    return {
      ok: true,
      user: toUserProfile(user),
    };
  }

  async createRoom({
    maxPlayers,
    nickname,
    ownerUserId,
    requestOrigin,
  }: CreateRoomInput): Promise<CreateRoomResponse> {
    ensureDatabaseReady();

    const normalizedNickname = assertValidNickname(nickname);
    const resolvedMaxPlayers = resolveMaxPlayers(maxPlayers);
    const owner = await userRepository.findById(ownerUserId);

    if (!owner) {
      throw new ApiError(404, {
        error: 'USER_NOT_FOUND',
        message: 'Usuario criador nao encontrado.',
      });
    }

    const roomCode = await generateRoomCode(async (candidate) =>
      Boolean(await roomRepository.findByCode(candidate)),
    );
    const room = await roomRepository.createRoom({
      maxPlayers: resolvedMaxPlayers,
      ownerNickname: normalizedNickname,
      ownerUserId,
      roomCode,
    });
    const realtimeRoom = await ensureRealtimeRoom(room);

    logger.info('room.created', {
      colyseusRoomId: realtimeRoom.roomId,
      ownerUserId,
      roomCode: room.roomCode,
      roomId: room.id,
    });

    return {
      colyseus: {
        assignedTeamId: 0,
        roomCode: room.roomCode,
        roomId: realtimeRoom.roomId,
        roomName: ROOM_NAME,
      },
      joinUrl: `${resolvePublicWebUrl(requestOrigin)}/sala/${room.roomCode}`,
      ok: true,
      room: toPublicRoom(room, ownerUserId),
    };
  }

  async lookupRoom(roomCode: string): Promise<RoomLookupResponse> {
    ensureDatabaseReady();

    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = await roomRepository.findByCode(normalizedRoomCode);

    if (!room) {
      return { ok: false, reason: 'ROOM_NOT_FOUND' };
    }

    const access = evaluateRoomJoin(room);
    if (access.canJoin) {
      return {
        ok: true,
        room: toPublicRoom(room),
      };
    }

    const reason = access.reason ?? 'ROOM_UNAVAILABLE';

    return {
      ok: false,
      reason,
    };
  }

  async listPublicRooms(): Promise<RoomListResponse> {
    ensureDatabaseReady();

    const rooms = await roomRepository.listPublicRooms();
    return {
      ok: true,
      rooms: rooms
        .map((room) => toPublicRoom(room))
        .filter((room) => room.canJoin),
    };
  }

  async listUserRooms(userId: string): Promise<RoomListResponse> {
    ensureDatabaseReady();

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, {
        error: 'USER_NOT_FOUND',
        message: 'Usuario nao encontrado.',
      });
    }

    const rooms = await roomRepository.listUserRooms(userId);
    return {
      ok: true,
      rooms: rooms.map((room) => toPublicRoom(room, userId)),
    };
  }

  async joinRoom({
    nickname,
    roomCode,
    userId,
  }: JoinRoomInput): Promise<JoinRoomResponse> {
    ensureDatabaseReady();

    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const normalizedNickname = assertValidNickname(nickname);
    const room = await roomRepository.findByCode(normalizedRoomCode);

    if (!room) {
      throw new ApiError(404, {
        message: getJoinFailureMessage('ROOM_NOT_FOUND'),
        ok: false,
        reason: 'ROOM_NOT_FOUND',
      });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, {
        error: 'USER_NOT_FOUND',
        message: 'Usuario nao encontrado.',
      });
    }

    const access = evaluateRoomJoin(room, userId);
    if (access.canJoin) {
      const participant = findParticipant(room, userId);
      const assignedTeamId =
        (participant?.team as 0 | 1 | null | undefined) ??
        nextAvailableTeamId(room);

      if (assignedTeamId === null) {
        throw new ApiError(409, {
          message: getJoinFailureMessage('ROOM_FULL'),
          ok: false,
          reason: 'ROOM_FULL',
        });
      }

      await roomRepository.upsertParticipant({
        nickname: normalizedNickname,
        roomId: room.id,
        status: participant?.status === 'disconnected' ? 'disconnected' : 'joined',
        team: assignedTeamId,
        seat: assignedTeamId === 0 ? 0 : 1,
        userId,
      });
      await roomRepository.touchRoom(room.id);
      await userRepository.touch(userId);

      const refreshedRoom = await roomRepository.findById(room.id);
      if (!refreshedRoom) {
        throw new ApiError(500, {
          error: 'ROOM_STATE_ERROR',
          message: 'Nao foi possivel recarregar a sala apos a entrada.',
        });
      }

      const realtimeRoom = await ensureRealtimeRoom(refreshedRoom);
      logger.info('room.join.authorized', {
        assignedTeamId,
        roomCode: refreshedRoom.roomCode,
        roomId: refreshedRoom.id,
        userId,
      });

      return {
        colyseus: {
          assignedTeamId,
          roomCode: refreshedRoom.roomCode,
          roomId: realtimeRoom.roomId,
          roomName: ROOM_NAME,
        },
        ok: true,
        room: toPublicRoom(refreshedRoom, userId),
      };
    }

    const reason = access.reason ?? 'ROOM_UNAVAILABLE';
    throw new ApiError(reason === 'ROOM_NOT_FOUND' ? 404 : 409, {
      message: getJoinFailureMessage(reason),
      ok: false,
      reason,
    });
  }

  async authorizeRealtimeJoin({
    assignedTeamId,
    nickname,
    persistentRoomId,
    roomCode,
    sessionId,
    userId,
  }: RealtimeJoinAuthorizationInput): Promise<RealtimeJoinAuthorization> {
    ensureDatabaseReady();

    if (assignedTeamId !== 0 && assignedTeamId !== 1) {
      throw new Error('Invalid team assignment for this room.');
    }

    const normalizedNickname = assertValidNickname(nickname);
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = await roomRepository.findById(persistentRoomId);

    if (!room || room.roomCode !== normalizedRoomCode) {
      throw new Error(getJoinFailureMessage('ROOM_NOT_FOUND'));
    }

    const access = evaluateRoomJoin(room, userId);
    if (!access.canJoin && access.reason) {
      throw new Error(getJoinFailureMessage(access.reason));
    }

    const participant = findParticipant(room, userId);
    if (!participant) {
      throw new Error('Este usuario nao possui permissao para entrar nesta sala.');
    }

    if (
      participant.team !== null &&
      participant.team !== undefined &&
      participant.team !== assignedTeamId
    ) {
      throw new Error('O assento reservado para este usuario nao corresponde a sala.');
    }

    await roomRepository.upsertParticipant({
      nickname: normalizedNickname,
      roomId: room.id,
      seat: assignedTeamId === 0 ? 0 : 1,
      sessionId,
      status: 'joined',
      team: assignedTeamId,
      userId,
    });
    await roomRepository.touchRoom(room.id);
    await userRepository.touch(userId);

    return {
      nickname: normalizedNickname,
      roomCode: room.roomCode,
      teamId: assignedTeamId,
      userId,
    };
  }

  async markParticipantDisconnected(roomId: string, userId: string): Promise<void> {
    if (!isDatabaseConfigured()) {
      return;
    }

    const participant = await roomRepository.findParticipant(roomId, userId);
    if (!participant) {
      return;
    }

    await roomRepository.upsertParticipant({
      nickname: participant.nickname,
      roomId,
      seat: participant.seat,
      sessionId: participant.sessionId,
      status: 'disconnected',
      team: participant.team,
      userId,
    });
    await roomRepository.touchRoom(roomId);
  }

  async markParticipantJoined(
    roomId: string,
    userId: string,
    sessionId: string,
  ): Promise<void> {
    if (!isDatabaseConfigured()) {
      return;
    }

    const participant = await roomRepository.findParticipant(roomId, userId);
    if (!participant) {
      return;
    }

    await roomRepository.upsertParticipant({
      nickname: participant.nickname,
      roomId,
      seat: participant.seat,
      sessionId,
      status: 'joined',
      team: participant.team,
      userId,
    });
    await roomRepository.touchRoom(roomId);
  }

  async markParticipantLeft(roomId: string, userId: string): Promise<void> {
    if (!isDatabaseConfigured()) {
      return;
    }

    const participant = await roomRepository.findParticipant(roomId, userId);
    if (!participant) {
      return;
    }

    await roomRepository.upsertParticipant({
      nickname: participant.nickname,
      roomId,
      seat: participant.seat,
      sessionId: null,
      status: 'left',
      team: participant.team,
      userId,
    });
    await roomRepository.touchRoom(roomId);
  }

  async markRoomPlaying(roomId: string): Promise<void> {
    if (!isDatabaseConfigured()) {
      return;
    }

    await roomRepository.setRoomStatus(roomId, 'playing');
  }

  async markRoomFinished(
    roomId: string,
    status: 'finished' | 'abandoned' = 'finished',
  ): Promise<void> {
    if (!isDatabaseConfigured()) {
      return;
    }

    await roomRepository.setRoomStatus(roomId, status);
  }
}

export const roomService = new RoomService();
