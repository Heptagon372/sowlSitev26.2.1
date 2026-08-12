import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * 필수 환경변수 검증 — 설계도 ② §8-1:
 * DB_ACCESS_PASSPHRASE 가 비어 있으면 애플리케이션은 부팅에 실패해야 한다.
 * (조용히 넘어가지 말 것)
 */
function assertRequiredEnv(): void {
  const missing = ['DB_ACCESS_PASSPHRASE', 'JWT_ACCESS_SECRET'].filter(
    (k) => !process.env[k]?.trim(),
  );
  if (missing.length > 0) {
    console.error(
      `[fatal] 필수 환경변수가 비어 있습니다: ${missing.join(', ')}\n` +
        `        apps/api/.env 를 확인하세요. (.env.example 참고)`,
    );
    process.exit(1);
  }
  if (!process.env.IP_HASH_SALT && process.env.NODE_ENV === 'production') {
    console.error('[fatal] production에서는 IP_HASH_SALT 가 필요합니다.');
    process.exit(1);
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.use(helmet());
  app.use(cookieParser());
  // 회원 채팅(/api/chat)은 socket.io 대신 표준 WebSocket을 쓴다 — 브라우저 내장 API로 붙는다
  app.useWebSocketAdapter(new WsAdapter(app));
  // JWT를 httpOnly 쿠키로 주고받으므로 credentials 허용이 필요하다
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('S.OWL API')
      .setDescription('SLEEPY OWL 모집 · 회원 · 관리자 API')
      .setVersion('2.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] listening on http://localhost:${port}/api`);
}

bootstrap();
