import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import { signSpikeMessage } from '@redphone/shared';

export function makeSpikeSignature(opts: { tamper: boolean }): {
  args: { pubkeyHex: string; message: string; sigHex: string };
  signMs: number;
  expectOk: boolean;
} {
  // Ephemeral per tap; persisted device keys are Phase 2 (ENR-05, UNL-02).
  const sk = getRandomBytes(32);
  try {
    const nonceHex = bytesToHex(getRandomBytes(16));
    const t0 = Date.now();
    const { pubkeyHex, message, sigHex } = signSpikeMessage(sk, nonceHex);
    const signMs = Date.now() - t0;
    let sent = message;
    if (opts.tamper) {
      const last = message.slice(-1);
      sent = message.slice(0, -1) + (last === '0' ? '1' : '0');
    }
    return { args: { pubkeyHex, message: sent, sigHex }, signMs, expectOk: !opts.tamper };
  } finally {
    sk.fill(0);
  }
}
