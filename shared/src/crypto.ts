import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const HEX_RE = /^[0-9a-f]*$/;
const PUBKEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;

export function sha256Hex(s: string): string {
  return bytesToHex(sha256(utf8ToBytes(s)));
}

/** First 16 hex of sha256(pubkey bytes), grouped `ABCD EF01 2345 6789`. */
export function fingerprint(pubkeyHex: string): string {
  const h = bytesToHex(sha256(hexToBytes(pubkeyHex))).slice(0, 16).toUpperCase();
  return h.match(/.{4}/g)!.join(' ');
}

export function joinMessage(secretHashHex: string, identityHex: string): string {
  return `redphone/v1|join|${secretHashHex}|${identityHex}`;
}

export function pubkeyOf(secretKey: Uint8Array): string {
  return bytesToHex(ed25519.getPublicKey(secretKey));
}

/** Returns sigHex over the join message. */
export function signJoin(secretKey: Uint8Array, secretHashHex: string, identityHex: string): string {
  return bytesToHex(ed25519.sign(utf8ToBytes(joinMessage(secretHashHex, identityHex)), secretKey));
}

/** Total: never throws. */
export function verifyJoin(pubkeyHex: string, message: string, sigHex: string): boolean {
  try {
    if (!PUBKEY_RE.test(pubkeyHex) || !SIG_RE.test(sigHex)) return false;
    if (typeof message !== 'string' || message.length > 256 || !message.startsWith('redphone/v1|join|')) return false;
    return ed25519.verify(hexToBytes(sigHex), utf8ToBytes(message), hexToBytes(pubkeyHex));
  } catch {
    return false;
  }
}

export function isHex(s: string): boolean {
  return HEX_RE.test(s);
}
