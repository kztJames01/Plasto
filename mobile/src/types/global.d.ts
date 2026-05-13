export {};

declare global {
  interface Crypto {
    randomUUID(): string;
  }
}
