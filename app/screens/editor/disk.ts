// The file as an editor counts it on disk: the `Buffer` record's text and hash, or, from a save's
// answer until the record says so too, the text just saved and the hash the server answered. So a
// save's own change never reads as the file changing underneath, and any other change does: an
// agent's write, a pull, another device's save.
import { type Accessor, computed, signal } from "nsh";
import type { Buffer } from "../../store/protocol";

/** A version of the file: its whole text, and the hash a save over it names. */
export type Disk = { hash: string; text: string };

export type TrackedDisk = {
  /** The file as it is on disk now. */
  disk: Accessor<Disk>;
  /** Says the version read with `from` was saved as `to`: the record's change is on its way. */
  saved: (from: string, to: Disk) => void;
};

export function trackDisk(read: Accessor<Buffer>): TrackedDisk {
  const answered = signal<{ from: string; to: Disk } | null>(null);
  const disk = computed(() => {
    const buffer = read();
    const saved = answered();
    // The record still holds the version the save replaced: the save's answer is newer. Once the
    // record moved, by the save or by anything else, it is the truth again.
    if (saved !== null && buffer.hash === saved.from) return saved.to;
    return { hash: buffer.hash, text: buffer.text };
  });
  return { disk, saved: (from, to) => answered.set({ from, to }) };
}
