import { describe, expect, it } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import {
  RFC8032_TEST1,
  SPIKE_MSG_PREFIX,
  SPIKE_TEST_VECTOR as V,
  signSpikeMessage,
  spikeMessageString,
  verifySpikeSignature,
} from './index';

describe('RFC 8032 TEST 1 cross-check', () => {
  it('noble derives the RFC public key', () => {
    const pk = ed25519.getPublicKey(hexToBytes(RFC8032_TEST1.secretKeyHex));
    expect(bytesToHex(pk)).toBe(RFC8032_TEST1.publicKeyHex);
  });
  it('noble reproduces the RFC signature over the empty message', () => {
    const sig = ed25519.sign(new Uint8Array(0), hexToBytes(RFC8032_TEST1.secretKeyHex));
    expect(bytesToHex(sig)).toBe(RFC8032_TEST1.signatureHex);
  });
});

describe('spike vector', () => {
  it('uses the RFC key and the expected message', () => {
    expect(V.secretKeyHex).toBe(RFC8032_TEST1.secretKeyHex);
    expect(V.publicKeyHex).toBe(RFC8032_TEST1.publicKeyHex);
    expect(V.message).toBe(SPIKE_MSG_PREFIX + V.nonceHex);
    expect(V.nonceHex).toBe('00112233445566778899aabbccddeeff');
  });
  it('signSpikeMessage reproduces the vector (deterministic)', () => {
    expect(signSpikeMessage(hexToBytes(V.secretKeyHex), V.nonceHex)).toEqual({
      pubkeyHex: V.publicKeyHex,
      message: V.message,
      sigHex: V.signatureHex,
    });
  });
  it('verifies the vector', () => {
    expect(verifySpikeSignature(V.publicKeyHex, V.message, V.signatureHex)).toBe(true);
  });
});

describe('verifySpikeSignature is total and strict', () => {
  it('rejects a changed message char', () => {
    const bad = V.message.slice(0, -1) + '0';
    expect(verifySpikeSignature(V.publicKeyHex, bad, V.signatureHex)).toBe(false);
  });
  it('rejects a correctly signed message without the prefix', () => {
    const msg = 'other|00112233445566778899aabbccddeeff';
    const sig = bytesToHex(ed25519.sign(new TextEncoder().encode(msg), hexToBytes(V.secretKeyHex)));
    expect(verifySpikeSignature(V.publicKeyHex, msg, sig)).toBe(false);
  });
  it('rejects a flipped signature byte', () => {
    const flipped = (V.signatureHex.startsWith('00') ? 'ff' : '00') + V.signatureHex.slice(2);
    expect(verifySpikeSignature(V.publicKeyHex, V.message, flipped)).toBe(false);
  });
  it('rejects uppercase and non-hex input without throwing', () => {
    expect(verifySpikeSignature(V.publicKeyHex.toUpperCase(), V.message, V.signatureHex)).toBe(false);
    expect(verifySpikeSignature(V.publicKeyHex, V.message, V.signatureHex.toUpperCase())).toBe(false);
    expect(verifySpikeSignature('zz'.repeat(32), V.message, V.signatureHex)).toBe(false);
  });
  it('rejects wrong lengths and oversize messages', () => {
    expect(verifySpikeSignature(V.publicKeyHex.slice(2), V.message, V.signatureHex)).toBe(false);
    expect(verifySpikeSignature(V.publicKeyHex, V.message, V.signatureHex.slice(2))).toBe(false);
    expect(verifySpikeSignature(V.publicKeyHex, V.message + 'a'.repeat(300), V.signatureHex)).toBe(false);
  });
});

describe('spikeMessageString', () => {
  it('builds prefix + nonce', () => {
    expect(spikeMessageString(V.nonceHex)).toBe(V.message);
  });
  it('throws on bad nonce', () => {
    expect(() => spikeMessageString('xyz')).toThrow();
    expect(() => spikeMessageString('00112233445566778899AABBCCDDEEFF')).toThrow();
  });
});
