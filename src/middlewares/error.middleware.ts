import type { Request, Response, NextFunction } from 'express';
import type { ZodIssue } from 'zod';

import { AppError } from '../errors/AppError.js';
import { formatValidationErrors } from '../helpers/formatValidationErrors.js';
import logger from '../utils/logger.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      code: err.code,
      message: err.message,
    };

    // Los errores de validación indican qué campo falló y por qué. No exponen datos
    // internos, así que se devuelven en todos los entornos para que el cliente pueda
    // mostrarlos. La traza, en cambio, solo en desarrollo.
    if (Array.isArray(err.details) && err.details.length > 0) {
      response.details = formatValidationErrors(err.details as ZodIssue[]);
    }

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
}