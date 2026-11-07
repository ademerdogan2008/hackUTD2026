import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { getRandomBytes } from 'expo-crypto';
import { getItem, removeItem, setItem } from './storage';

const KEY = 'rp.pin';
const ITERATIONS = 10_000;

function derive(pin: string, salt: Uint8Array): string {
  return bytesToHex(pbkdf2(sha256, utf8ToBytes(pin), salt, { c: ITERATIONS, dkLen: 32 }));
}

/** Stored as `<saltHex>:<hashHex>`. */
export async function setPin(pin: string): Promise<void> {
  const salt = getRandomBytes(16);
  await setItem(KEY, `${bytesToHex(salt)}:${derive(pin, salt)}`);
}

export async function hasPin(): Promise<boolean> {
  return !!(await getItem(KEY));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getItem(KEY);
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const got = derive(pin, hexToBytes(saltHex));
  // constant-time-ish compare
  let diff = got.length ^ hashHex.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (hashHex.charCodeAt(i) || 0);
  return diff === 0;
}

export async function clearPin(): Promise<void> {
  await removeItem(KEY);
}
