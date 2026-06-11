/**
 * Node/Bun-only helpers for the parser. Kept out of the browser-safe core
 * (and the `index.ts` barrel) because `Bun.file` has no meaning in a browser,
 * where files arrive via the File API instead. Used by tests and local tooling.
 */

import { parseXer, decodeXer, type XerDocument } from "./xer";

/** Read and parse an XER file from disk (Bun runtime). */
export async function readXerFile(path: string): Promise<XerDocument> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return parseXer(decodeXer(bytes));
}
