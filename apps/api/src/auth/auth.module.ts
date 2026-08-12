import { Global, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LogsService } from '../common/logs/logs.service';
import {
  AdminGuard,
  AuthGuard,
  ElevatedGuard,
  MemberGuard,
} from '../common/guards/auth.guards';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * 전역 모듈 — 가드(TokenService/LogsService 의존)를 어느 모듈에서든
 * @UseGuards 로 쓸 수 있게 export 한다.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LogsService,
    AuthGuard,
    MemberGuard,
    AdminGuard,
    ElevatedGuard,
  ],
  exports: [TokenService, LogsService, AuthGuard, MemberGuard, AdminGuard, ElevatedGuard],
})
export class AuthModule implements OnApplicationBootstrap {
  constructor(private readonly auth: AuthService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.auth.bootstrapAdmin();
  }
}
