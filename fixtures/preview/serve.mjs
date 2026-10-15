// A fake Storybook, for the tests of the preview runner, its proxy, and the embeds:
// `node serve.mjs --port <port> [--mode <mode>] [--delay <ms>] [--log <file>]`.
//
// It appends its start to the log file, as one JSON line `{ base, cwd, pid, port }`, then serves,
// from its working folder:
// - `/index.json`: one story entry per `export const X` of each `*.stories.*` file;
// - `/`: Storybook's own interface, as its manager draws it: the stories' list, and the story of
//   its `?path=/story/<id>`, or its first, in a frame titled "storybook-preview-iframe", as
//   Storybook's is;
// - `/iframe.html?id=<id>`: a page holding the export's name, a button counting its clicks, a
//   separator, the colour mode it was sent, the module script `/story.js`, and the skill's pick
//   script, with a `Content-Security-Policy` that forbids framing it, which the proxy replaces. Its
//   script opens Storybook's channel, beside the page, and shows "Channel open" once it answers;
// - WebSockets at `/storybook-server-channel`, refused when their `Origin` is `null`, and under
//   `URAEDA_PREVIEW_BASE` for the `vite-hmr` protocol, which each send one message: the path, the
//   query's values by name, `Host`, `Origin`, and headers they got, as JSON;
// - `/__echo`: the path, the query's values by name, `Host`, `Origin`, and headers it got, as JSON;
// - `/__headers`: an answer with a cookie, `Clear-Site-Data`, and `x-custom`, which its
//   `Connection` names;
// - `/__index-reads`: how many requests for the index it got;
// - `/__events`: a first chunk, then held open.
//
// Its modes: `ok`; `fail`, which prints `Error: Cannot find module 'storybook'` and exits 1; `hang`,
// which never answers `/index.json`; `hang-later`, which answers it once, then never again;
// `bad-index`, which serves `not json` as the index; `no-pick`, without the pick script; `child`,
// which starts a child that keeps its output open, and outlives it. `--delay` waits before
// listening. A taken port prints `Port <port> is not available` and exits 1.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join, relative } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    delay: { default: "0", type: "string" },
    log: { type: "string" },
    mode: { default: "ok", type: "string" },
    port: { type: "string" },
  },
});
const port = Number(values.port);
const mode = values.mode;
const base = process.env.URAEDA_PREVIEW_BASE ?? "/";
const PICK = join(import.meta.dirname, "../../skills/uraeda/assets/storybook/uraeda-pick.js");

if (values.log) {
  const start = { base, cwd: process.cwd(), pid: process.pid, port };
  appendFileSync(values.log, `${JSON.stringify(start)}\n`);
}

if (mode === "fail") {
  process.stderr.write("Starting Storybook…\nError: Cannot find module 'storybook'\n");
  process.exit(1);
}

if (mode === "child") {
  spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/** The `*.stories.*` files under `folder`, without `node_modules` and hidden folders. */
function storyFiles(folder) {
  const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
      files.push(...storyFiles(path));
    } else if (entry.isFile() && /\.stories\.[a-z]+$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

/** The index, as Storybook's `index.json` v5, read again from the files at each request. */
function storyIndex() {
  const entries = {};
  for (const file of storyFiles(process.cwd())) {
    const title = basename(file).replace(/\.stories\.[a-z]+$/, "");
    const importPath = `./${relative(process.cwd(), file)}`;
    for (const [, exportName] of readFileSync(file, "utf8").matchAll(/export const (\w+)/g)) {
      const id = `${title}--${exportName}`.toLowerCase();
      entries[id] = { exportName, id, importPath, name: exportName, tags: [], title, type: "story" };
    }
  }
  return { entries, v: 5 };
}

/** The story page of the entry `id`, or undefined when the index has none. */
function storyPage(id) {
  const entry = storyIndex().entries[id];
  if (!entry) {
    return undefined;
  }
  const pick = mode === "no-pick" ? "" : '<script src="uraeda-pick.js"></script>';
  return `<!doctype html>
<html lang="en" data-mode="none">
<head><meta charset="utf-8"><title>${entry.exportName}</title>${pick}</head>
<body>
<h1>${entry.exportName}</h1>
<p id="mode">No mode</p>
<button type="button" id="hide">Hide the sidebar</button>
<p id="clicks">Clicked 0 times</p>
<div role="separator" tabindex="0" style="height: 8px; background: gray"></div>
<script type="module" src="story.js"></script>
</body>
</html>
`;
}

/** Storybook's own interface: the stories' list, and the story `path` names, framed. */
function managerPage(path) {
  const entries = Object.values(storyIndex().entries);
  const id = /^\/story\/(.+)$/.exec(path ?? "")?.[1] ?? entries[0]?.id ?? "";
  const items = entries
    .map((entry) => `<li><a href="?path=/story/${entry.id}">${entry.title} ${entry.name}</a></li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Storybook</title></head>
<body>
<nav aria-label="Stories"><ul>${items}</ul></nav>
<iframe id="storybook-preview-iframe" title="storybook-preview-iframe" src="iframe.html?id=${id}&amp;viewMode=story"></iframe>
</body>
</html>
`;
}

/** The story's own script, which counts the button's clicks and shows the mode it is sent. */
const STORY_JS = `let clicks = 0;
document.getElementById("hide").addEventListener("click", () => {
  clicks += 1;
  document.getElementById("clicks").textContent =
    "Clicked " + clicks + (clicks === 1 ? " time" : " times");
});
const channel = new WebSocket(new URL("storybook-server-channel", location.href).href.replace(/^http/, "ws"));
channel.addEventListener("message", () => {
  const open = document.createElement("p");
  open.textContent = "Channel open";
  document.body.append(open);
}, { once: true });
window.addEventListener("message", (event) => {
  if (event.data && event.data.uraeda === "mode") {
    document.documentElement.dataset.mode = event.data.mode;
    document.getElementById("mode").textContent = "Mode: " + event.data.mode;
  }
});
`;

/** What a request got: its path, its query's values, `Host`, `Origin`, and headers. */
function echo(request) {
  const query = {};
  for (const [name, value] of new URL(request.url, "http://localhost").searchParams) {
    (query[name] ??= []).push(value);
  }
  return JSON.stringify({
    headers: request.headers,
    host: request.headers.host ?? null,
    origin: request.headers.origin ?? null,
    path: request.url,
    query,
  });
}

function send(response, status, type, body, headers = {}) {
  response.writeHead(status, { "Content-Type": type, ...headers });
  response.end(body);
}

/** How many requests for the index it got. */
let indexReads = 0;

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const path = url.pathname;
  if (path === "/index.json") {
    indexReads += 1;
    if (mode === "hang" || (mode === "hang-later" && indexReads > 1)) {
      return;
    }
    const body = mode === "bad-index" ? "not json" : JSON.stringify(storyIndex());
    return send(response, 200, "application/json", body);
  }
  if (path === "/" || path === "/index.html") {
    return send(response, 200, "text/html; charset=utf-8", managerPage(url.searchParams.get("path")));
  }
  if (path === "/iframe.html") {
    const page = storyPage(url.searchParams.get("id") ?? "");
    return page
      ? send(response, 200, "text/html; charset=utf-8", page, {
          "Content-Security-Policy": "frame-ancestors 'none'",
        })
      : send(response, 404, "text/plain", "No such story");
  }
  if (path === "/story.js") {
    return send(response, 200, "text/javascript", STORY_JS);
  }
  if (path === "/uraeda-pick.js") {
    return send(response, 200, "text/javascript", readFileSync(PICK));
  }
  if (path === "/__echo") {
    return send(response, 200, "application/json", echo(request));
  }
  if (path === "/__headers") {
    return send(response, 200, "text/plain", "headers", {
      "Clear-Site-Data": '"cookies", "storage"',
      Connection: "x-custom",
      "Set-Cookie": "session=storybook; Path=/",
      "x-custom": "1",
    });
  }
  if (path === "/__index-reads") {
    return send(response, 200, "application/json", String(indexReads));
  }
  if (path === "/__events") {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write("data: first\n\n");
    return;
  }
  send(response, 404, "text/plain", "Not found");
});

/** One WebSocket text frame, from the server, of a message under 64 KB. */
function textFrame(text) {
  const payload = Buffer.from(text);
  const header =
    payload.length < 126
      ? Buffer.from([0x81, payload.length])
      : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 0xff]);
  return Buffer.concat([header, payload]);
}

server.on("upgrade", (request, socket) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const protocol = request.headers["sec-websocket-protocol"];
  const channel = path === "/storybook-server-channel";
  const hmr = path.startsWith(base) && protocol === "vite-hmr";
  if (channel && request.headers.origin === "null") {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  if (!channel && !hmr) {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    return;
  }
  const accept = createHash("sha1")
    .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      ...(hmr ? ["Sec-WebSocket-Protocol: vite-hmr"] : []),
      "",
      "",
    ].join("\r\n"),
  );
  socket.write(textFrame(echo(request)));
  socket.on("error", () => {});
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    process.stderr.write(`Port ${port} is not available\n`);
    process.exit(1);
  }
  throw error;
});

setTimeout(() => {
  server.listen(port, "127.0.0.1", () => {
    process.stdout.write(`Storybook ready on http://127.0.0.1:${port}/\n`);
  });
}, Number(values.delay));
