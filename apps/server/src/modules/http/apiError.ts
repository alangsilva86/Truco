export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly payload: Record<string, unknown>,
  ) {
    super(
      typeof payload.message === 'string'
        ? payload.message
        : 'Request could not be completed.',
    );
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
