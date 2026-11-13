// What a person typed to pair, read as the server takes it: the access key as it is, or a code,
// whose letters and digits the server reads in any case and with any separator.
import type { Given } from "../shell/host";

/** The access key's mark: Uraeda's keys start with it. */
const KEY = "ura_";

/** `typed` as a key or a code: `undefined` when it holds neither. */
export function pairingOf(typed: string): Given | undefined {
  const trimmed = typed.trim();
  if (trimmed.startsWith(KEY)) return { key: trimmed };
  const symbols = trimmed.replace(/[^0-9a-z]/gi, "");
  return symbols.length === 0 ? undefined : { code: symbols.toUpperCase() };
}
