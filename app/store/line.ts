// The one WebSocket of a connection, behind a seam: `Opener` makes the line, and the default one is
// the platform's `WebSocket`. A test passes an opener that wraps the real one, to see what is sent,
// hold what comes, or drop the line, against the real server: never a stand-in of the protocol.

/**
 * A line to the server: one frame per message. The client sends text frames only; the server's
 * binary frames hold a message whose large part is compressed (the contract's "Frames").
 */
export type Line = {
  send(text: string): void;
  /** Ends the line: `closed` follows. */
  close(): void;
};

/** What the line tells its connection. `closed` comes once, whether it opened or not. */
export type Heard = {
  opened(): void;
  /** A frame of the server: a message's text, or a binary frame's bytes. */
  message(frame: string | ArrayBuffer): void;
  closed(): void;
};

/** Opens a line to `url`, a `ws:` or `wss:` address. */
export type Opener = (url: string, heard: Heard) => Line;

/** How long a message waits when Native Shell's socket holds as many as it queues, eight. */
const FULL_WAIT = 4;

/**
 * The platform's WebSocket. Native Shell's queues at most eight messages to send and throws past
 * them, so the line keeps the rest, in order, and hands them over as it drains: a screen that
 * subscribes to twenty records at once sends twenty `sub`s.
 */
export const openSocket: Opener = (url, heard) => {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  const waiting: string[] = [];
  let pumping: number | undefined;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    waiting.length = 0;
    if (pumping !== undefined) clearTimeout(pumping);
    heard.closed();
  };
  const pump = () => {
    pumping = undefined;
    if (ended) return;
    while (waiting.length > 0) {
      try {
        socket.send(waiting[0]!);
      } catch (error) {
        if ((error as { code?: string }).code !== "ERR_NSH_QUOTA_EXCEEDED") throw error;
        pumping = setTimeout(pump, FULL_WAIT);
        return;
      }
      waiting.shift();
    }
  };
  socket.addEventListener("open", () => heard.opened());
  socket.addEventListener("message", (event) => {
    const { data } = event as WebSocketMessageEvent;
    if (typeof data === "string" || data instanceof ArrayBuffer) heard.message(data);
  });
  socket.addEventListener("error", end);
  socket.addEventListener("close", end);
  return {
    close: () => {
      socket.close();
      end();
    },
    send: (text) => {
      waiting.push(text);
      if (pumping === undefined) pump();
    },
  };
};

/** The address of `/live` on the server at `address`, `http://127.0.0.1:4420`. */
export function liveUrl(address: string): string {
  return `${address.replace(/\/+$/, "").replace(/^http/, "ws")}/live`;
}
