import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainStateError } from '../domain/PracticeAttempt.js';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  if (err instanceof DomainStateError) {
    res.status(409).json({
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: err.message,
      },
    });
    return;
  }

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected server error occurred' : err.message,
    },
  });
}
