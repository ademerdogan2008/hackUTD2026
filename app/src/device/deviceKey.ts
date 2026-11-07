import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getRandomBytes } from 'expo-crypto';
import { getItem, removeItem, setItem } from './storage';

const KEY = 'rp.device_sk';

export interface DeviceKey {
  secretKey: Uint8Array;
  publicKeyHex: string;
}

/** Load the device Ed25519 secret key, creating and persisting one if missing. */
export async function getOrCreateDeviceKey(): Promise<DeviceKey> {
  const stored = await getItem(KEY);
  let sk: Uint8Array | null = null;
  if (stored && /^[0-9a-f]{64}$/i.test(stored)) sk = hexToBytes(stored);
  if (!sk) {
    sk = getRandomBytes(32);
    await setItem(KEY, bytesToHex(sk));
  }
  return { secretKey: sk, publicKeyHex: bytesToHex(ed25519.getPublicKey(sk)) };
}

export async function hasDeviceKey(): Promise<boolean> {
  const stored = await getItem(KEY);
  return !!stored && /^[0-9a-f]{64}$/i.test(stored);
}

export async function clearDeviceKey(): Promise<void> {
  await removeItem(KEY);
}

export async function getDeviceSecretKey(): Promise<Uint8Array> {
  return (await getOrCreateDeviceKey()).secretKey;
}

export async function getPublicKeyHex(): Promise<string> {
  return (await getOrCreateDeviceKey()).publicKeyHex;
}
