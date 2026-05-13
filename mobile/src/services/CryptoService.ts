import nacl from 'tweetnacl';
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from 'bip39';
import { Buffer } from 'buffer';
import { Identity } from '../types/identity';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bytesToBase58(bytes: Uint8Array): string {
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

function base58ToBytes(str: string): Uint8Array {
  const BASE = BigInt(ALPHABET.length);
  let num = BigInt(0);
  for (const char of str) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base58 character');
    }
    num = num * BASE + BigInt(index);
  }
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num & BigInt(0xff)));
    num = num >> BigInt(8);
  }
  for (const char of str) {
    if (char === ALPHABET[0]) {
      bytes.unshift(0);
    } else {
      break;
    }
  }
  return new Uint8Array(bytes);
}

export class CryptoService {
  static generateDeviceKeypair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
    return nacl.sign.keyPair();
  }

  static generateIdentity(): Identity {
    const keypair = nacl.sign.keyPair();
    const entropy = nacl.randomBytes(16);
    const mnemonic = entropyToMnemonic(Buffer.from(entropy).toString('hex'));

    return {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      mnemonic,
    };
  }

  static deriveFromMnemonic(mnemonic: string): Identity {
    if (!validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    const entropyHex = mnemonicToEntropy(mnemonic);
    const seed = Buffer.from(entropyHex, 'hex');
    const keypair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

    return {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      mnemonic,
    };
  }

  static encodePublicKeyBase58(publicKey: Uint8Array): string {
    return bytesToBase58(publicKey);
  }

  static decodePublicKeyBase58(encoded: string): Uint8Array {
    return base58ToBytes(encoded);
  }

  static sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
    return nacl.sign.detached(message, secretKey);
  }

  static verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return nacl.sign.detached.verify(message, signature, publicKey);
  }
}
