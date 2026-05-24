import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { appendFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join } from 'path';

type RequestWithUser = Request & {
  user?: { id?: string; sub?: string };
};

function formatExceptionMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object' && response !== null) {
      const body = response as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        return body.message.join(' ');
      }
      if (typeof body.message === 'string') {
        return body.message;
      }
    }
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  if (typeof exception === 'string') {
    return exception;
  }

  return 'Unexpected error';
}

@Injectable()
@Catch()
export class PersistentExceptionFilter implements ExceptionFilter {
  private readonly logDir = process.env.ERROR_LOG_DIR || join(process.cwd(), 'logs');

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithUser>();
    const requestId = request.headers['x-request-id']?.toString() || randomUUID();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = formatExceptionMessage(exception);

    if (status >= 500) {
      await this.writeErrorLog({
        timestamp: new Date().toISOString(),
        requestId,
        method: request.method,
        path: request.originalUrl || request.url,
        status,
        userId: request.user?.id || request.user?.sub || null,
        message,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      requestId,
    });
  }

  private async writeErrorLog(entry: Record<string, unknown>) {
    try {
      await mkdir(this.logDir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      await appendFile(
        join(this.logDir, `server-errors-${day}.jsonl`),
        `${JSON.stringify(entry)}\n`,
        'utf8',
      );
    } catch (error) {
      console.error('Failed to persist backend error log', error);
    }
  }
}
