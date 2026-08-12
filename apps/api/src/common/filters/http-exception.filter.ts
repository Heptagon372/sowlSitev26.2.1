import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ERROR_CODES, type ApiErrorBody } from '@sowl/shared';
import type { Request, Response } from 'express';

/**
 * 에러 응답 형식 통일: { statusCode, code, message }
 * 로그에는 개인정보(요청 본문)를 남기지 않는다 — 경로·상태코드만 기록.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL;
    let message = '서버 오류가 발생했습니다.';

    if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = ERROR_CODES.RATE_LIMITED;
      message = '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        if (typeof b.code === 'string') code = b.code;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = (b.message as string[]).join(', ');
      }
      if (code === ERROR_CODES.INTERNAL) {
        if (status === HttpStatus.BAD_REQUEST) code = ERROR_CODES.VALIDATION_FAILED;
        else if (status === HttpStatus.UNAUTHORIZED) code = ERROR_CODES.UNAUTHENTICATED;
        else if (status === HttpStatus.NOT_FOUND) code = ERROR_CODES.NOT_FOUND;
      }
    } else {
      // 알 수 없는 오류 — 스택은 남기되 요청 본문은 남기지 않는다
      this.logger.error(
        `${req.method} ${req.path} → 500`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.path} → ${status}`);
    }

    const payload: ApiErrorBody = { statusCode: status, code, message };
    res.status(status).json(payload);
  }
}
