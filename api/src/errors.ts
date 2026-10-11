/** Errors that are safe to show to API callers. Anything else becomes a generic 500. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);
