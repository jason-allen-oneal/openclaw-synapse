import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

export function verifySignature(payload: string, signature: string, publicKey: string): boolean {
  try {
    const verify = crypto.createVerify('SHA256');
    verify.update(payload);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  } catch (err) {
    return false;
  }
}

export function generateToken(nodeId: string): string {
  return jwt.sign({ nodeId }, JWT_SECRET, { expiresIn: '10y' }); // Long-lived
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}