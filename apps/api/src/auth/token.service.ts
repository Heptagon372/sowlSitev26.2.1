import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@sowl/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';

export interface AccessPayload {
  sub: string; // User.id
  sid: string; // studentId
  role: Role;
  name: string;
}

export const ACCESS_COOKIE = 'sowl_access';
export const REFRESH_COOKIE = 'sowl_refresh';
export const ELEVATED_COOKIE = 'sowl_elev';

/** '30m' | '14d' | '15s' | '2h' → ms */
export function ttlMs(text: string | undefined, fallback: string): number {
  const m = /^(\d+)([smhd])$/.exec((text ?? fallback).trim());
  if (!m) return ttlMs(fallback, '30m');
  const n = Number(m[1]);
  return { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]]! * n;
}

/**
 * JWT는 httpOnly · Secure(prod) · SameSite=Lax 쿠키로만 전달한다.
 * localStorage 저장 금지. (설계도 ② §4-2)
 */
@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  private base(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    };
  }

  get accessTtl(): number {
    return ttlMs(process.env.ACCESS_TOKEN_TTL, '30m');
  }
  get refreshTtl(): number {
    return ttlMs(process.env.REFRESH_TOKEN_TTL, '14d');
  }

  signAccess(payload: AccessPayload): string {
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: Math.floor(this.accessTtl / 1000),
    });
  }

  verifyAccess(token: string): AccessPayload | null {
    try {
      return this.jwt.verify<AccessPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      return null;
    }
  }

  /** DB 접근 비밀번호 확인 후 발급되는 15분짜리 elevated 세션 (재발급 없음) */
  signElevated(userId: string): string {
    return this.jwt.sign(
      { sub: userId, elev: true },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: 15 * 60 },
    );
  }

  verifyElevated(token: string, userId: string): boolean {
    try {
      const p = this.jwt.verify<{ sub: string; elev?: boolean }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      return p.elev === true && p.sub === userId;
    } catch {
      return false;
    }
  }

  /** 리프레시 토큰 원문은 쿠키에만 — DB에는 SHA-256 해시만 저장한다 */
  newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    return {
      token,
      hash: this.hashRefresh(token),
      expiresAt: new Date(Date.now() + this.refreshTtl),
    };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  setAuthCookies(res: Response, access: string, refresh: string): void {
    res.cookie(ACCESS_COOKIE, access, { ...this.base(), maxAge: this.accessTtl, path: '/' });
    res.cookie(REFRESH_COOKIE, refresh, {
      ...this.base(),
      maxAge: this.refreshTtl,
      path: '/api/auth', // 갱신·로그아웃 요청에만 실려간다
    });
  }

  setElevatedCookie(res: Response, token: string): void {
    res.cookie(ELEVATED_COOKIE, token, {
      ...this.base(),
      maxAge: 15 * 60_000,
      path: '/api/admin',
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.clearCookie(ELEVATED_COOKIE, { path: '/api/admin' });
  }
}
