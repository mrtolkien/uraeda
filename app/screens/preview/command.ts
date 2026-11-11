// A preview's command as a card shows it: short, its whole in a tip.

/**
 * `command` with each absolute path in it written from `root`, the checkout's top level, and one
 * outside the checkout by its file name: `node /home/a/web/serve.mjs --port {port}` in `/home/a`
 * reads `node web/serve.mjs --port {port}`, and outside it `node …/serve.mjs --port {port}`.
 */
export function shortCommand(command: string, root: string | null | undefined): string {
  const top = root?.replace(/\/+$/, "");
  return command
    .split(/(\s+)/)
    .map((part) => {
      if (!part.startsWith("/")) return part;
      if (top && part.startsWith(`${top}/`)) return part.slice(top.length + 1);
      const name = part.replace(/\/+$/, "").split("/").at(-1);
      return name ? `…/${name}` : part;
    })
    .join("");
}
