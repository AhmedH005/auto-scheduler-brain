import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 7;

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_EXPIRY_DAYS}d` });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

export function generateTokenId(): string {
  return crypto.randomUUID();
}

export function getRefreshExpiryDate(): Date {
  return new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}
