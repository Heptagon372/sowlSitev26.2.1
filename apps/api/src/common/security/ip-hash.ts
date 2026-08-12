import { createHash } from 'node:crypto';

/**
 * 로그용 IP 해시 — 원본 IP는 어디에도 저장하지 않는다.
 * SHA-256(ip + IP_HASH_SALT) 앞 16자만 보관한다. (설계도 ② §9-2)
 */
export function ipHash16(ip: string | undefined): string {
  const salt = process.env.IP_HASH_SALT ?? 'sowl-dev-salt';
  return createHash('sha256')
    .update(`${ip ?? 'unknown'}${salt}`)
    .digest('hex')
    .slice(0, 16);
}
