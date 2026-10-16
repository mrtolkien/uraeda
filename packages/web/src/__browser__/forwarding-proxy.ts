// The forwarding proxy of SC-006's test, run by the test server in Node: a browser reaches the test
// server through it, under the listed host name.
import { createServer, request as forward } from "node:http";
import { type AddressInfo, connect } from "node:net";

/**
 * A forwarding proxy to the test server's port, for a browser that sends every request through it:
 * absolute-form requests, and `CONNECT` tunnels for its sockets. The host name the browser asked
 * for stays in each request's `Host`.
 */
export async function forwardingProxy(port: number) {
  const proxy = createServer((request, response) => {
    const url = new URL(request.url ?? "/");
    const upstream = forward(
      {
        headers: request.headers,
        host: "127.0.0.1",
        method: request.method,
        path: url.pathname + url.search,
        port,
      },
      (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      },
    );
    upstream.on("error", () => response.destroy());
    request.pipe(upstream);
  });
  proxy.on("connect", (_request, socket, head) => {
    const upstream = connect(port, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  // WebKit sends a socket's upgrade in absolute form too: it goes on as the same request.
  proxy.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/");
    const upstream = connect(port, "127.0.0.1", () => {
      const lines = [`${request.method} ${url.pathname}${url.search} HTTP/1.1`];
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        lines.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
      }
      upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  return { close: () => proxy.close(), port: (proxy.address() as AddressInfo).port };
}
