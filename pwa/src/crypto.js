import nacl from 'tweetnacl';
import { mnemonicToSeedSync, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bytesToBase58(bytes) {
  const BASE = BigInt(ALPHABET.length);
  let num = BigInt(0);
  for (const byte of bytes) {
    num = (num << BigInt(8)) | BigInt(byte);
  }
  let result = '';
  while (num > BigInt(0)) {
    result = ALPHABET[Number(num % BASE)] + result;
    num = num / BASE;
  }
  for (const byte of bytes) {
    if (byte === 0) {
      result = ALPHABET[0] + result;
    } else {
      break;
    }
  }
  return result || ALPHABET[0];
}

export function keysFromMnemonic(mnemonic) {
  const phrase = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(phrase)) {
    throw new Error('Invalid recovery phrase');
  }
  const seed = mnemonicToSeedSync(phrase).subarray(0, 32);
  const kp = nacl.sign.keyPair.fromSeed(seed);
  return {
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    pubkey: bytesToBase58(kp.publicKey),
  };
}

export function signUtf8(message, secretKey) {
  const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), secretKey);
  return Buffer.from(sig).toString('base64');
}
