/**
 * Global type declarations for Cloudflare Workers with nodejs_compat flag
 */

// Buffer is available via nodejs_compat compatibility flag
declare const Buffer: {
  from(arrayBuffer: ArrayBuffer): Buffer;
  from(data: string, encoding?: string): Buffer;
  from(data: Uint8Array): Buffer;
  concat(buffers: Buffer[]): Buffer;
  alloc(size: number): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
};

interface Buffer extends Uint8Array {
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
  toString(encoding?: string): string;
}
