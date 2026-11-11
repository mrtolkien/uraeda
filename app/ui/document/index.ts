// The document renderer: `Document` draws the core's tree of a workflow file, `Reply` an agent's
// reply as it streams, `Diff` a file's diff. None reads Markdown in TSX: the server sends a file's
// tree, and Rust splits a reply into blocks and reads each one once (`uraeda/native`).
export type { DocumentHands } from "./context";
export { Diff, type DiffProps } from "./Diff";
export { Document, type DocumentProps } from "./Document";
export { Reply, type ReplyProps } from "./Reply";
