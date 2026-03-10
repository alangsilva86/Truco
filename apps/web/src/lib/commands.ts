import { AvailableAction, GameCommand } from '@truco/contracts';

export function createCommand<T extends GameCommand['type']>(
  type: T,
  payload: Extract<GameCommand, { type: T }>['payload'],
): Extract<GameCommand, { type: T }> {
  return {
    commandId: crypto.randomUUID(),
    issuedAt: Date.now(),
    type,
    payload,
  } as Extract<GameCommand, { type: T }>;
}

export function findAction<T extends AvailableAction['type']>(
  actions: AvailableAction[],
  type: T,
): Extract<AvailableAction, { type: T }> | null {
  return (actions.find((action) => action.type === type) ?? null) as Extract<
    AvailableAction,
    { type: T }
  > | null;
}
