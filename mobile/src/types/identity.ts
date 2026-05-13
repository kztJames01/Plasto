export interface Identity {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  mnemonic: string;
}

export interface StoredKeys {
  publicKey: string;
  secretKey: string;
}
