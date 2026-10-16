// The access key and the sessions of the server, in `sign-in.json` in the data folder: the only
// place they are stored, and this store its only writer.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hash, randomToken, sameHash } from "./tokens.ts";

/** The sign-in file's name, in the data folder. */
export const SIGN_IN_FILE = "sign-in.json";
/** How many days after its last use a session ends. */
export const SESSION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
/** The longest a session may go unused, in milliseconds. */
const SESSION_MS = SESSION_DAYS * DAY_MS;

/** A signed-in device: its public ID, its secret's hash, and when it was made and last used. */
type Session = { created: string; id: string; secret: string; used: string };

/** The sign-in file, as written. */
type SignInFile = { key: string; sessions: Array<Session>; version: 1 };

/**
 * Whether a value read from the file is a session, every field a string, and its dates dates: a
 * session whose last use is no date would never end.
 */
function isSession(value: unknown): value is Session {
  const session = value as Record<string, unknown> | null;
  return (
    typeof session === "object" &&
    session !== null &&
    ["created", "id", "secret", "used"].every((field) => typeof session[field] === "string") &&
    ["created", "used"].every((field) => !Number.isNaN(Date.parse(session[field] as string)))
  );
}

/**
 * The file's content, or the reason it is not one this version of Uraeda wrote: one written by a
 * newer Uraeda is refused rather than read wrong.
 */
function parse(text: string): SignInFile | string {
  const file = JSON.parse(text) as Partial<SignInFile> | null;
  if (typeof file !== "object" || file === null) {
    return "not an object";
  }
  if (file.version !== 1) {
    return `version ${JSON.stringify(file.version)} is not 1`;
  }
  if (typeof file.key !== "string" || !Array.isArray(file.sessions)) {
    return "no key or no sessions";
  }
  return file.sessions.every(isSession)
    ? (file as SignInFile)
    : "a session is incomplete, or has a date that is not one";
}

/** A new access key: `ura_` and 32 random bytes in base64url. */
const newKey = () => `ura_${randomToken(32)}`;

/**
 * The access key's hash and the sessions, read once at the start and kept in memory, written to
 * the file on every change. Each session has an abort signal, aborted when it ends, for the live
 * streams it opened.
 */
export class SignInStore {
  /** The sessions' abort controllers, made when a signal is first asked for. */
  private readonly controllers = new Map<string, AbortController>();
  private readonly listeners: Array<(id: string) => void> = [];
  /** The access key's hash. */
  private key: string;
  private readonly now: () => number;
  private readonly path: string;
  private readonly sessions: Map<string, Session>;

  private constructor(path: string, key: string, sessions: Array<Session>, now: () => number) {
    this.key = key;
    this.now = now;
    this.path = path;
    this.sessions = new Map(sessions.map((session) => [session.id, session]));
  }

  /**
   * The store of a data folder, its file read once. At the first start, the file does not exist:
   * a key is made, its hash written, and the key returned, the only time it is. A file that cannot
   * be read, or that this version did not write, is refused and left as it is; so is a folder the
   * new file cannot be written to.
   */
  static open(dataDir: string, now: () => number = Date.now): { key?: string; store: SignInStore } {
    const path = join(dataDir, SIGN_IN_FILE);
    let text: string | undefined;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw unreadable(path, (error as Error).message, error);
      }
    }
    if (text === undefined) {
      const key = newKey();
      const store = new SignInStore(path, hash(key), [], now);
      try {
        mkdirSync(dataDir, { mode: 0o700, recursive: true });
      } catch (error) {
        throw unwritable(path, error);
      }
      store.write();
      return { key, store };
    }
    let file: SignInFile | string;
    try {
      file = parse(text);
    } catch (error) {
      throw unreadable(path, (error as Error).message, error);
    }
    if (typeof file === "string") {
      throw unreadable(path, file);
    }
    return { store: new SignInStore(path, file.key, file.sessions, now) };
  }

  /** Makes a new access key and returns it, the only time it is shown; every session ends. */
  replaceKey(): string {
    const key = newKey();
    this.key = hash(key);
    this.endAll();
    return key;
  }

  /** Whether a text is the access key, spaces and line breaks around it ignored. */
  checkKey(text: string): boolean {
    return sameHash(hash(text.trim()), this.key);
  }

  /** Makes a session, and returns its cookie's value, `<id>.<secret>`, never stored. */
  createSession(): string {
    const [id, secret] = [randomToken(16), randomToken(32)];
    const now = new Date(this.now()).toISOString();
    this.sessions.set(id, { created: now, id, secret: hash(secret), used: now });
    this.write();
    return `${id}.${secret}`;
  }

  /**
   * The session a cookie names, unless its secret is wrong or it has ended: one unused for more
   * than 30 days ends now. Its use is recorded at most once a day, `refreshed` then, so the file is
   * not written on every request, and the cookie can be set again.
   */
  findSession(cookie: string | undefined): { id: string; refreshed: boolean } | undefined {
    const [id, secret] = cookie?.split(".") ?? [];
    const session = id === undefined ? undefined : this.sessions.get(id);
    if (!session || secret === undefined || !sameHash(hash(secret), session.secret)) {
      return undefined;
    }
    const now = this.now();
    const unused = now - Date.parse(session.used);
    if (unused > SESSION_MS) {
      this.endSession(id);
      return undefined;
    }
    if (unused < DAY_MS) {
      return { id, refreshed: false };
    }
    session.used = new Date(now).toISOString();
    this.write();
    return { id, refreshed: true };
  }

  /** Ends a session: signed out, its streams closed. One already gone is no error. */
  endSession(id: string): void {
    if (this.sessions.delete(id)) {
      this.writeEnded([id]);
    }
  }

  /** Ends every session. */
  endAll(): void {
    const ids = [...this.sessions.keys()];
    this.sessions.clear();
    this.writeEnded(ids);
  }

  /** Ends every session unused for more than 30 days. */
  sweep(): void {
    const now = this.now();
    const ids = [...this.sessions.values()]
      .filter((session) => now - Date.parse(session.used) > SESSION_MS)
      .map((session) => session.id);
    if (ids.length > 0) {
      ids.forEach((id) => this.sessions.delete(id));
      this.writeEnded(ids);
    }
  }

  /** The signal aborted when a session ends: already aborted for one that has. */
  signal(id: string): AbortSignal {
    if (!this.sessions.has(id)) {
      return AbortSignal.abort();
    }
    let controller = this.controllers.get(id);
    if (!controller) {
      controller = new AbortController();
      this.controllers.set(id, controller);
    }
    return controller.signal;
  }

  /** Calls `listener` with the ID of every session that ends, once each. */
  onEnded(listener: (id: string) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Writes the file without the sessions `ids`, already gone from memory, then ends them: even when
   * the write throws, their streams close and the listeners are told, before it is thrown.
   */
  private writeEnded(ids: Array<string>): void {
    try {
      this.write();
    } finally {
      this.ended(ids);
    }
  }

  /** Aborts the ended sessions' signals, and tells the listeners. */
  private ended(ids: Array<string>): void {
    for (const id of ids) {
      this.controllers.get(id)?.abort();
      this.controllers.delete(id);
      this.listeners.forEach((listener) => listener(id));
    }
  }

  /**
   * Writes the file, readable by its owner only, to a temporary file renamed over it, so a crash
   * never leaves half a file.
   */
  private write(): void {
    const file: SignInFile = { key: this.key, sessions: [...this.sessions.values()], version: 1 };
    const temporary = `${this.path}.${randomToken(6)}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(file, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      renameSync(temporary, this.path);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw unwritable(this.path, error);
    }
  }
}

/** The error of a file that cannot be read, with what the human can do. */
function unreadable(path: string, reason: string, cause?: unknown): Error {
  return new Error(
    `cannot read ${path}: ${reason}. Fix it, or delete it to make a new access key and sign every device out.`,
    { cause },
  );
}

/** The error of a file that cannot be written. */
function unwritable(path: string, cause: unknown): Error {
  return new Error(`cannot write ${path}: ${(cause as Error).message}`, { cause });
}
