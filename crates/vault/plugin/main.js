// Uraeda's plugin: syncs this vault with `ura serve` on the desktop, and links to its pages.
// Plain JavaScript, no build step: `ura` embeds this file and writes it into the vault, and the sync
// carries it to the phone. The desktop decides every sync (crates/vault/src/plan.rs): this file
// lists the phone's files, asks for the plan, and carries it out.
//
// Its settings, `data.json`, are each device's own and never synced: `url`, the address of
// `ura serve` with its token, and `sync`, false on the desktop, where the vault is `ura`'s own.

const { Plugin, Notice, PluginSettingTab, Setting, requestUrl, MarkdownView } = require("obsidian");

const PLUGIN_DIR = ".obsidian/plugins/uraeda";
const PLUGIN_FILES = ["main.js", "manifest.json"];
const EVERY = 60 * 1000;
const AFTER_EDIT = 5 * 1000;

/** Whether a path travels: no hidden name, save the plugin's own files. */
function synced(path) {
  if (PLUGIN_FILES.some((f) => path === PLUGIN_DIR + "/" + f)) return true;
  return !path.split("/").some((part) => part.startsWith("."));
}

function stamp() {
  const d = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}${two(d.getMinutes())}`;
}

async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

module.exports = class Uraeda extends Plugin {
  async onload() {
    this.data = Object.assign(
      { url: "", sync: false, base: {}, hashes: {}, last: "", vault: "" },
      await this.loadData(),
    );
    this.running = null;
    this.again = false;
    this.quietUntil = 0;
    this.addSettingTab(new Settings(this.app, this));
    this.addRibbonIcon("inbox", "Uraeda: what waits on you", () => this.open(""));
    this.addCommand({
      id: "open-waiting",
      name: "Open what waits on you",
      callback: () => this.open(""),
    });
    this.registerEvent(this.app.workspace.on("file-open", () => this.markAsk()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.markAsk()));
    if (!this.data.sync) return;
    this.addRibbonIcon("refresh-cw", "Uraeda: sync now", () => this.sync(true));
    this.addCommand({ id: "sync", name: "Sync now", callback: () => this.sync(true) });
    this.app.workspace.onLayoutReady(() => this.sync(false));
    this.registerDomEvent(document, "visibilitychange", () => {
      if (document.visibilityState === "visible") this.sync(false);
    });
    this.registerInterval(
      window.setInterval(() => {
        if (document.visibilityState === "visible") this.sync(false);
      }, EVERY),
    );
    const edited = () => {
      if (Date.now() < this.quietUntil) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.sync(false), AFTER_EDIT);
    };
    for (const name of ["create", "modify", "delete", "rename"])
      this.registerEvent(this.app.vault.on(name, edited));
  }

  onunload() {
    window.clearTimeout(this.timer);
  }

  /** `ura serve`'s address, with its token, ending in `/`. */
  base() {
    const url = (this.data.url || "").trim();
    return url && !url.endsWith("/") ? url + "/" : url;
  }

  token() {
    const parts = this.base().replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || "";
  }

  open(page) {
    if (!this.base())
      return new Notice("Uraeda: no address of ura serve in this plugin's settings.");
    window.open(this.base() + page);
  }

  /** On a round, a spec, or a plan that waits on the human, a button to its page. */
  markAsk() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !view.file) return;
    view.uraeda?.remove();
    view.uraeda = null;
    const match = view.file.path.match(/^projects\/([^/]+)\/specs\/([^/]+)\/([^/]+\.md)$/);
    const status = this.app.metadataCache.getFileCache(view.file)?.frontmatter?.status;
    if (!match || status !== "awaiting-human") return;
    const [, repo, folder, name] = match;
    let page = null;
    if (/^clarifications-\d+\.md$/.test(name)) page = `${repo}/${folder}/round`;
    else if (name === "spec.md" || name === "plan.md") page = `${repo}/${folder}/review/${name}`;
    if (!page) return;
    const label = page.endsWith("round") ? "Answer on ura serve" : "Review on ura serve";
    view.uraeda = view.addAction("external-link", label, () => this.open(page));
  }

  async call(method, path, body, contentType) {
    return requestUrl({
      url: this.base() + path,
      method,
      body,
      contentType,
      headers: { Authorization: "Bearer " + this.token() },
      throw: false,
    });
  }

  /** The vault's files that travel, with their hashes, read again only when changed. */
  async files() {
    const adapter = this.app.vault.adapter;
    const out = {};
    const hashes = {};
    const walk = async (dir) => {
      const listed = await adapter.list(dir);
      for (const folder of listed.folders) {
        const keep = synced(folder) || (PLUGIN_DIR + "/").startsWith(folder + "/");
        if (keep) await walk(folder);
      }
      for (const file of listed.files) {
        if (!synced(file)) continue;
        const stat = await adapter.stat(file);
        if (!stat) continue;
        const known = this.data.hashes[file];
        const hash =
          known && known[0] === stat.size && known[1] === stat.mtime
            ? known[2]
            : await sha256(await adapter.readBinary(file));
        out[file] = hash;
        hashes[file] = [stat.size, stat.mtime, hash];
      }
    };
    await walk("");
    this.data.hashes = hashes;
    return out;
  }

  /** One sync at a time: a sync asked during one runs after it. */
  async sync(asked) {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.run(asked).finally(() => {
      this.running = null;
      this.quietUntil = Date.now() + 2000;
      if (this.again) {
        this.again = false;
        this.sync(false);
      }
    });
    return this.running;
  }

  async run(asked) {
    try {
      const report = await this.once();
      this.data.last =
        `${new Date().toLocaleString()}: ${report.in} in, ${report.out} out, ${report.kept} kept` +
        (report.refused ? `, ${report.refused} to retry` : "");
      if (asked || report.kept) new Notice("Uraeda: " + this.data.last, report.kept ? 10000 : 4000);
      await this.saveData(this.data);
      if (report.plugin) window.setTimeout(() => this.reload(), 200);
    } catch (e) {
      this.data.last = `${new Date().toLocaleString()}: failed, ${e && e.message ? e.message : e}`;
      await this.saveData(this.data);
      new Notice("Uraeda sync failed: " + (e && e.message ? e.message : e), 15000);
    }
  }

  async once() {
    const adapter = this.app.vault.adapter;
    const local = await this.files();
    const answer = await this.call(
      "POST",
      "vault/plan",
      JSON.stringify({
        files: local,
        base: this.data.base,
        stamp: stamp(),
        vault: this.data.vault || "",
      }),
      "application/json",
    );
    if (answer.status !== 200)
      throw new Error(`ura serve answered ${answer.status}: ${answer.text}`);
    const actions = answer.json.actions;
    this.data.vault = answer.json.vault;
    for (const folder of answer.json.folders || []) {
      if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    }
    const report = { in: 0, out: 0, kept: 0, refused: 0, plugin: false };
    const touched = new Set();
    const base = this.data.base;
    const query = (path, expect) =>
      `vault/file?path=${encodeURIComponent(path)}` +
      (expect === undefined ? "" : `&expect=${encodeURIComponent(expect || "")}`);
    const write = async (path, buffer) => {
      const parts = path.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
      }
      await adapter.writeBinary(path, buffer);
    };
    for (const a of actions) {
      touched.add(a.path);
      if (a.do === "pull") {
        const got = await this.call("GET", query(a.path));
        if (got.status !== 200) {
          report.refused++;
          continue;
        }
        await write(a.path, got.arrayBuffer);
        base[a.path] = a.hash;
        report.in++;
        if (a.path.startsWith(PLUGIN_DIR + "/")) report.plugin = true;
      } else if (a.do === "push") {
        const sent = await this.call(
          "PUT",
          query(a.path, a.expect),
          await adapter.readBinary(a.path),
          "application/octet-stream",
        );
        if (sent.status !== 200) {
          report.refused++;
          continue;
        }
        base[a.path] = a.hash;
        report.out++;
      } else if (a.do === "copy") {
        touched.add(a.to);
        const buffer = await adapter.readBinary(a.path);
        await write(a.to, buffer);
        const sent = await this.call("PUT", query(a.to, null), buffer, "application/octet-stream");
        if (sent.status !== 200) {
          report.refused++;
          continue;
        }
        base[a.to] = a.hash;
        report.kept++;
      } else if (a.do === "trash") {
        if (await adapter.exists(a.path)) await adapter.trashLocal(a.path);
        delete base[a.path];
        report.in++;
      } else if (a.do === "trash-remote") {
        const sent = await this.call("DELETE", query(a.path, a.expect));
        if (sent.status !== 200) {
          report.refused++;
          continue;
        }
        delete base[a.path];
        report.out++;
      } else if (a.do === "forget") {
        delete base[a.path];
      }
    }
    // A file in no action is the same on both sides.
    for (const [path, hash] of Object.entries(local)) if (!touched.has(path)) base[path] = hash;
    return report;
  }

  /** Loads the plugin's new version, which the sync just brought. */
  async reload() {
    const plugins = this.app.plugins;
    await plugins.disablePlugin(this.manifest.id);
    await plugins.enablePlugin(this.manifest.id);
  }
};

class Settings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const plugin = this.plugin;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Address of ura serve")
      .setDesc("With its token, as ura serve prints it, or as the starter vault set it.")
      .addText((text) =>
        text.setValue(plugin.data.url).onChange(async (value) => {
          plugin.data.url = value.trim();
          await plugin.saveData(plugin.data);
        }),
      );
    if (!plugin.data.sync) {
      containerEl.createEl("p", { text: "This vault is ura's own: it is not synced from here." });
      return;
    }
    new Setting(containerEl)
      .setName("Sync now")
      .setDesc(plugin.data.last ? "Last sync: " + plugin.data.last : "Not synced yet.")
      .addButton((button) =>
        button.setButtonText("Sync").onClick(async () => {
          await plugin.sync(true);
          this.display();
        }),
      );
  }
}
