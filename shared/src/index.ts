import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Domain-separation prefix. Plain ASCII, pipe-delimited, versioned: phone and
// module hash identical bytes.
export const SPIKE_MSG_PREFIX = 'redphone/v1|spike|';

const NONCE_RE = /^[0-9a-f]{32}$/;
const PUBKEY_RE = /^[0-9a-f]{64}$/;
const SIG_RE = /^[0-9a-f]{128}$/;
const MAX_MESSAGE_LEN = 256;

export function spikeMessageString(nonceHex: string): string {
  if (!NONCE_RE.test(nonceHex)) throw new Error('nonceHex must be 32 lowercase hex chars');
  return SPIKE_MSG_PREFIX + nonceHex;
}

export function signSpikeMessage(
  secretKey: Uint8Array,
  nonceHex: string,
): { pubkeyHex: string; message: string; sigHex: string } {
  const message = spikeMessageString(nonceHex);
  const sig = ed25519.sign(new TextEncoder().encode(message), secretKey);
  return {
    pubkeyHex: bytesToHex(ed25519.getPublicKey(secretKey)),
    message,
    sigHex: bytesToHex(sig),
  };
}

// Total: never throws.
export function verifySpikeSignature(pubkeyHex: string, message: string, sigHex: string): boolean {
  try {
    if (typeof pubkeyHex !== 'string' || typeof sigHex !== 'string' || typeof message !== 'string') {
      return false;
    }
    if (!PUBKEY_RE.test(pubkeyHex) || !SIG_RE.test(sigHex)) return false;
    if (message.length > MAX_MESSAGE_LEN) return false;
    if (!message.startsWith(SPIKE_MSG_PREFIX)) return false;
    return ed25519.verify(
      hexToBytes(sigHex),
      new TextEncoder().encode(message),
      hexToBytes(pubkeyHex),
    );
  } catch {
    return false;
  }
}

// RFC 8032 section 7.1 TEST 1 (empty message).
export const RFC8032_TEST1: Readonly<{
  secretKeyHex: string;
  publicKeyHex: string;
  messageHex: string;
  signatureHex: string;
}> = {
  secretKeyHex: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  publicKeyHex: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  messageHex: '',
  signatureHex:
    'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155' +
    '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
};

export const SPIKE_TEST_VECTOR: Readonly<{
  secretKeyHex: string;
  publicKeyHex: string;
  nonceHex: string;
  message: string;
  signatureHex: string;
}> = {
  secretKeyHex: RFC8032_TEST1.secretKeyHex,
  publicKeyHex: RFC8032_TEST1.publicKeyHex,
  nonceHex: '00112233445566778899aabbccddeeff',
  message: 'redphone/v1|spike|00112233445566778899aabbccddeeff',
  signatureHex:
    'fb78f4b1ec42c207f4a4c0768aae09d83f1e0b6bef840e2f2e704945a0726d9b' +
    '6c12a45ef507b5b75149ef8dcd5f739cdfc71e7c603aae4ab101f4b96ebfd004',
};
