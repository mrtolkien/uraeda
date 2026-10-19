import { chmodSync, writeFileSync } from "node:fs";

const quote = (value: string) => `'${value.replaceAll("'", String.raw`'\''`)}'`;

/**
 * Writes the script the adapter runs as its `command`: it runs Claude Code in the case's image with
 * the arguments it is given. Every path the adapter hands over (`--plugin-dir`, `--add-dir`) is
 * mounted at its own path, the repository copy at `/app`, where the image's installed packages
 * expect it, and the bare `origin` and the configuration folder at their own paths. The token goes
 * in by name: its value is never in the arguments.
 */
export function writeWrapper(options: {
  bareOrigin: string;
  claude: string;
  configDir: string;
  image: string;
  label: string;
  path: string;
  repository: string;
}): string {
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "args=(run --rm -i --init --entrypoint claude -w /app",
    `  --label ${quote(`benchmark-run=${options.label}`)}`,
    '  --user "$(id -u):$(id -g)"',
    `  -v ${quote(`${options.repository}:/app`)}`,
    `  -v ${quote(`${options.bareOrigin}:${options.bareOrigin}`)}`,
    `  -v ${quote(`${options.claude}:/usr/local/bin/claude:ro`)}`,
    `  -v ${quote(`${options.configDir}:${options.configDir}`)}`,
    `  -e ${quote(`CLAUDE_CONFIG_DIR=${options.configDir}`)}`,
    "  -e CLAUDE_CODE_OAUTH_TOKEN -e HOME=/tmp/home)",
    'prev=""',
    'for arg in "$@"; do',
    '  case "$prev" in',
    '    --plugin-dir) args+=(-v "$arg:$arg:ro") ;;',
    '    --add-dir) args+=(-v "$arg:$arg") ;;',
    "  esac",
    '  prev="$arg"',
    "done",
    `exec docker "\${args[@]}" ${quote(options.image)} "$@"`,
    "",
  ];
  writeFileSync(options.path, lines.join("\n"));
  chmodSync(options.path, 0o755);
  return options.path;
}
