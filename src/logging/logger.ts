/**
 * Winston structured logging for Synthesis Labs
 *
 * Replaces console.log with structured logging supporting:
 * - JSON format with timestamp, level, message
 * - Child loggers with trace context (traceId, agent, stage)
 * - Configurable log levels via LOG_LEVEL env var
 */

import winston from 'winston';

export interface LogContext {
  traceId?: string;
  agent?: string;
  stage?: string;
  [key: string]: unknown;
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'synthesis-labs' },
  transports: [
    new winston.transports.Console(),
  ],
});

export function createChildLogger(context: LogContext): winston.Logger {
  return logger.child(context);
}
