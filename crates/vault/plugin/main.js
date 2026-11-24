// Uraeda's plugin: syncs this vault with `ura serve` on the desktop, and links to its pages.
// Plain JavaScript, no build step: `ura` embeds this file and writes it into the vault, and the sync
// carries it to the phone. The desktop decides every sync (crates/vault/src/plan.rs): this file
// lists the phone's files, asks for the plan, and carries it out.
//
// Beside the sync, it draws what the notes need on both devices: the board of a project's proposals
// (a Bases view, `uraeda-board`: cards drag into their rank, and a started one is marked done in a
// tap) and the home, which shows the active projects and replaces a new tab. Its `styles.css` is
// the vault's look: a mossy background, and frosted panes above it.
//
// Its settings, `data.json`, are each device's own and never synced: `url`, the address of
// `ura serve`, `token`, the token it sends with every request of the sync, `sync`, false on the
// desktop, where the vault is `ura`'s own and the pages open in a browser that signs in, and
// `homeInNewTab`, whether a new tab opens the home, and `background`, `moss` or `tree`.

const {
  Plugin,
  Notice,
  PluginSettingTab,
  Setting,
  requestUrl,
  MarkdownView,
  ItemView,
  BasesView,
  Menu,
  Keymap,
  setIcon,
} = require("obsidian");

const PLUGIN_DIR = ".obsidian/plugins/uraeda";
const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"];
const HOME_TYPE = "uraeda-home";
const BOARD_TYPE = "uraeda-board";

/** The board's columns, in order: a proposal's `status`, and what the column is called. */
const COLUMNS = [
  ["started", "Started"],
  ["now", "Now"],
  ["next", "Next"],
  ["later", "Later"],
  ["idea", "Idea"],
  ["postponed", "Postponed"],
  ["done", "Done"],
];
/** The statuses of a proposal that is worked on or about to be: what the home shows. */
const ACTIVE = ["started", "now", "next"];
const EVERY = 60 * 1000;
const AFTER_EDIT = 5 * 1000;
const PARALLEL = 6;

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
      {
        url: "",
        token: "",
        sync: false,
        homeInNewTab: true,
        background: "moss",
        base: {},
        hashes: {},
        last: "",
        vault: "",
      },
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
    this.registerViews();
    this.applyBackground();
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
    document.body.classList.remove("uraeda-bg-tree");
  }

  /** The vault's background: `moss`, a texture, or `tree`, the logo's bonsai grown wide. */
  applyBackground() {
    document.body.classList.toggle("uraeda-bg-tree", this.data.background === "tree");
  }

  /** The board and the home, and the home taking the place of a new tab. */
  registerViews() {
    this.registerView(HOME_TYPE, (leaf) => new HomeView(leaf, this));
    this.addRibbonIcon("sprout", "Uraeda: home", () => this.openHome());
    this.addCommand({ id: "open-home", name: "Open home", callback: () => this.openHome() });
    const board = BasesView
      ? this.registerBasesView(BOARD_TYPE, {
          name: "Board",
          icon: "lucide-kanban",
          factory: (controller, containerEl) => new BoardView(controller, containerEl),
        })
      : false;
    if (!board)
      new Notice("Uraeda: this Obsidian cannot draw the board: turn on the Bases plugin.");
    const fill = () => this.fillNewTabs();
    this.registerEvent(this.app.workspace.on("layout-change", fill));
    this.app.workspace.onLayoutReady(fill);
  }

  /** A new tab, which Obsidian opens empty, shows the home instead. */
  fillNewTabs() {
    if (!this.data.homeInNewTab) return;
    const { workspace } = this.app;
    for (const leaf of workspace.getLeavesOfType("empty")) {
      if (leaf.getRoot() !== workspace.rootSplit) continue;
      leaf.setViewState({ type: HOME_TYPE, active: leaf === workspace.getMostRecentLeaf() });
    }
  }

  async openHome() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(HOME_TYPE)[0];
    const leaf = existing || workspace.getLeaf("tab");
    if (!existing) await leaf.setViewState({ type: HOME_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  /** `ura serve`'s address, ending in `/`. */
  base() {
    const url = (this.data.url || "").trim();
    return url && !url.endsWith("/") ? url + "/" : url;
  }

  token() {
    return (this.data.token || "").trim();
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
    this.fresh = 0;
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
        const same = known && known[0] === stat.size && known[1] === stat.mtime;
        if (!same) this.fresh++;
        const hash = same ? known[2] : await sha256(await adapter.readBinary(file));
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
        (report.refused ? `, ${report.refused} to retry` : "") +
        (report.error ? ` (${report.error})` : "");
      if (asked || report.kept) new Notice("Uraeda: " + this.data.last, report.kept ? 10000 : 4000);
      // Its record holds a line per file: written only when a sync changed something.
      if (asked || report.actions || this.fresh) await this.saveData(this.data);
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
    if (answer.status === 401)
      throw new Error("ura serve refused the token: check it in this plugin's settings");
    if (answer.status !== 200)
      throw new Error(`ura serve answered ${answer.status}: ${answer.text}`);
    const actions = answer.json.actions;
    this.data.vault = answer.json.vault;
    for (const folder of answer.json.folders || []) {
      if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
    }
    const report = { in: 0, out: 0, kept: 0, refused: 0, plugin: false, actions: 0 };
    const touched = new Set();
    const base = this.data.base;
    const query = (path, expect) =>
      `vault/file?path=${encodeURIComponent(path)}` +
      (expect === undefined ? "" : `&expect=${encodeURIComponent(expect || "")}`);
    const write = async (path, buffer) => {
      const parts = path.split("/").slice(0, -1);
      for (let i = 1; i <= parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        // Two files of one new folder arrive at once: the second finds it made.
        if (!(await adapter.exists(dir))) await adapter.mkdir(dir).catch(() => {});
      }
      await adapter.writeBinary(path, buffer);
    };
    // Whether the phone's file is still the one the plan was made from: an edit made since is
    // never written over or trashed, and the next sync plans with it.
    const still = async (path) => {
      const stat = await adapter.stat(path);
      if (!stat) return local[path] === undefined;
      if (local[path] === undefined) return false;
      const known = this.data.hashes[path];
      if (known && known[0] === stat.size && known[1] === stat.mtime) return true;
      return (await sha256(await adapter.readBinary(path))) === local[path];
    };
    const act = async (a) => {
      touched.add(a.path);
      const refused = (response) => response.status !== 200 && ++report.refused;
      const edited = async () => !(await still(a.path)) && ++report.refused;
      if (a.do === "pull") {
        const got = await this.call("GET", query(a.path));
        if (refused(got) || (await edited())) return false;
        await write(a.path, got.arrayBuffer);
        base[a.path] = a.hash;
        report.in++;
        if (a.path.startsWith(PLUGIN_DIR + "/")) report.plugin = true;
      } else if (a.do === "push") {
        const body = await adapter.readBinary(a.path);
        const sent = await this.call(
          "PUT",
          query(a.path, a.expect),
          body,
          "application/octet-stream",
        );
        if (refused(sent)) return false;
        // What was sent, which an edit since the plan made differ from the plan's.
        base[a.path] = await sha256(body);
        report.out++;
      } else if (a.do === "copy") {
        touched.add(a.to);
        const buffer = await adapter.readBinary(a.path);
        await write(a.to, buffer);
        const sent = await this.call("PUT", query(a.to, null), buffer, "application/octet-stream");
        if (refused(sent)) return false;
        base[a.to] = a.hash;
        report.kept++;
      } else if (a.do === "trash") {
        if (await edited()) return false;
        if (await adapter.exists(a.path)) await adapter.trashLocal(a.path);
        delete base[a.path];
        report.in++;
      } else if (a.do === "trash-remote") {
        const sent = await this.call("DELETE", query(a.path, a.expect));
        if (refused(sent)) return false;
        delete base[a.path];
        report.out++;
      } else if (a.do === "forget") {
        delete base[a.path];
      }
      return true;
    };
    // A file's actions run in order, a copy before its pull; files run 6 at a time.
    const groups = new Map();
    for (const a of actions) groups.set(a.path, [...(groups.get(a.path) || []), a]);
    const queue = [...groups.values()];
    const worker = async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const a of group) {
          // A file that fails, by a name this device refuses or a read that finds it gone, is
          // retried by the next sync, and stops no other file.
          const done = await act(a).catch((e) => {
            report.refused++;
            report.error = report.error || `${a.path}: ${e && e.message ? e.message : e}`;
            return false;
          });
          if (!done) break;
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    report.actions = actions.length;
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
      .setDesc("As ura serve prints it, or as the starter vault set it.")
      .addText((text) =>
        text.setValue(plugin.data.url).onChange(async (value) => {
          plugin.data.url = value.trim();
          await plugin.saveData(plugin.data);
        }),
      );
    new Setting(containerEl)
      .setName("Background")
      .setDesc("What shows behind the panes on this device.")
      .addDropdown((drop) =>
        drop
          .addOption("moss", "Moss")
          .addOption("tree", "Tree")
          .setValue(plugin.data.background)
          .onChange(async (value) => {
            plugin.data.background = value;
            await plugin.saveData(plugin.data);
            plugin.applyBackground();
          }),
      );
    new Setting(containerEl)
      .setName("Home in new tabs")
      .setDesc("A new tab shows the active projects instead of an empty page.")
      .addToggle((toggle) =>
        toggle.setValue(plugin.data.homeInNewTab).onChange(async (value) => {
          plugin.data.homeInNewTab = value;
          await plugin.saveData(plugin.data);
          if (value) plugin.fillNewTabs();
        }),
      );
    if (!plugin.data.sync) {
      containerEl.createEl("p", { text: "This vault is ura's own: it is not synced from here." });
      return;
    }
    new Setting(containerEl)
      .setName("Token")
      .setDesc(
        "The token ura serve prints under its address: the sync sends it with every request.",
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text.setValue(plugin.data.token).onChange(async (value) => {
          plugin.data.token = value.trim();
          await plugin.saveData(plugin.data);
        });
      });
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

// The notes' own views: the board of a project's proposals, and the home.

function toRank(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

/**
 * A proposal as the board and the home read it. `pending` holds the edits of a card just moved,
 * which the notes' cache has not caught up with: an edit stays until the cache agrees with it.
 */
function proposal(app, file, pending) {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};
  let status = fm.status == null ? "" : String(fm.status).trim().toLowerCase();
  let rank = toRank(fm.rank);
  const edit = pending?.get(file.path);
  if (edit) {
    if ((edit.status === status && edit.rank === rank) || Date.now() - edit.at > 5000)
      pending.delete(file.path);
    else ({ status, rank } = edit);
  }
  return {
    file,
    path: file.path,
    title: file.basename,
    status,
    rank,
    branch: fm.branch ? String(fm.branch) : "",
  };
}

/** Lowest rank first; a card without a rank comes after the ranked ones, by name. */
function byRank(a, b) {
  const x = a.rank ?? Infinity;
  const y = b.rank ?? Infinity;
  return x === y ? a.title.localeCompare(b.title) : x < y ? -1 : 1;
}

/**
 * The ranks that put `card` at `index` of a column, `column` being the column's cards without it,
 * in order: a map of each card whose rank must be written. A card between two numbers takes the
 * middle of them, so one note is written; with no room left, or a card without a rank before the
 * place, the column is numbered again from 1, and only the cards whose number changed are written.
 */
function placeAt(column, card, index) {
  const before = column[index - 1];
  const after = column[index];
  if (!before || before.rank !== null) {
    const lo = before ? before.rank : null;
    const hi = after ? after.rank : null;
    if (lo === null || hi === null || hi - lo > 1e-6) {
      const rank =
        lo === null && hi === null
          ? 1
          : lo === null
            ? hi - 1
            : hi === null
              ? lo + 1
              : (lo + hi) / 2;
      return new Map([[card, rank]]);
    }
  }
  const list = column.slice();
  list.splice(index, 0, card);
  const out = new Map();
  list.forEach((c, i) => {
    if (c === card || c.rank !== i + 1) out.set(c, i + 1);
  });
  return out;
}

const QUIET = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Runs `change`, which moves `els` about, and slides each from where it was to where it is. */
function flip(els, change) {
  const before = els.map((el) => el.getBoundingClientRect());
  change();
  if (QUIET()) return;
  els.forEach((el, i) => {
    const now = el.getBoundingClientRect();
    const dx = before[i].left - now.left;
    const dy = before[i].top - now.top;
    if (dx || dy)
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
        duration: 160,
        easing: "cubic-bezier(.2,.7,.3,1)",
      });
  });
}

function chip(parent, icon, text, cls) {
  const el = parent.createSpan({ cls: "uraeda-chip " + (cls || "") });
  setIcon(el.createSpan("uraeda-chip-icon"), icon);
  el.createSpan({ cls: "uraeda-chip-text", text });
  return el;
}

/**
 * A project's board, a Bases view: a column per status, and the cards in their rank. A card drags
 * to where it belongs, in its column or into another, with a mouse or a finger held on it; the rank
 * is written in its note and never shown. A started card has a button that marks it done.
 */
class BoardView extends (BasesView ?? class {}) {
  constructor(controller, containerEl) {
    super(controller);
    this.type = BOARD_TYPE;
    this.pending = new Map();
    this.lanes = [];
    this.drag = null;
    this.hold = null;
    this.suppress = false;
    this.rootEl = containerEl.createDiv("uraeda-board");
    // A finger that has held a card moves it, and the board stays where it is.
    this.registerDomEvent(
      this.rootEl,
      "touchmove",
      (e) => {
        if (this.drag) e.preventDefault();
      },
      { passive: false },
    );
  }

  onDataUpdated() {
    if (this.drag || this.adding) this.stale = true;
    else this.render();
  }

  onunload() {
    this.release();
    this.drag?.ghost.remove();
  }

  render() {
    this.stale = false;
    const entries = this.data?.data ?? [];
    const cards = entries
      .filter((e) => e.file && e.file.extension === "md")
      .map((e) => proposal(this.app, e.file, this.pending));
    const known = new Set(COLUMNS.map(([status]) => status));
    this.lanes = COLUMNS.map(([status, label]) => ({
      status,
      label,
      droppable: true,
      cards: cards.filter((c) => c.status === status).sort(byRank),
    }));
    const other = cards.filter((c) => !known.has(c.status)).sort(byRank);
    if (other.length)
      this.lanes.push({ status: "", label: "No status", droppable: false, cards: other });
    const { scrollLeft, scrollTop } = this.rootEl;
    this.rootEl.empty();
    for (const lane of this.lanes) this.renderLane(lane);
    this.rootEl.scrollLeft = scrollLeft;
    this.rootEl.scrollTop = scrollTop;
  }

  renderLane(lane) {
    const el = this.rootEl.createDiv({ cls: "uraeda-lane", attr: { "data-status": lane.status } });
    const head = el.createDiv("uraeda-lane-head");
    head.createSpan("uraeda-lane-dot");
    head.createSpan({ cls: "uraeda-lane-name", text: lane.label });
    head.createSpan({ cls: "uraeda-lane-count", text: String(lane.cards.length) });
    lane.el = el;
    lane.listEl = el.createDiv("uraeda-lane-cards");
    if (lane.droppable) this.renderAdd(lane);
    for (const card of lane.cards) this.renderCard(lane, card);
  }

  /** The `+` at the top of a column: a tap asks for a title, and Enter adds the proposal there. */
  renderAdd(lane) {
    const add = lane.listEl.createDiv({
      cls: "uraeda-add",
      attr: { role: "button", tabindex: "0", "aria-label": "Add a proposal" },
    });
    setIcon(add.createSpan("uraeda-add-icon"), "plus");
    const ask = () => {
      if (this.adding) return;
      this.adding = true;
      add.addClass("is-editing");
      add.empty();
      const input = add.createEl("input", { type: "text", attr: { placeholder: "Title" } });
      input.focus();
      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        this.adding = false;
        const title = input.value;
        if (save && title.trim()) this.create(lane, title);
        if (this.stale || !save || !title.trim()) this.render();
      };
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.isComposing) finish(true);
        else if (e.key === "Escape") finish(false);
      });
      input.addEventListener("blur", () => finish(false));
    };
    add.addEventListener("click", ask);
    add.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target === add) ask();
    });
  }

  /** The folder of the board's proposals: its project's, or where its cards are. */
  proposalsDir() {
    const base =
      this.queryController?.currentFile?.path || this.app.workspace.getActiveFile()?.path || "";
    const project = base.match(/^(projects\/[^/]+)\//);
    if (project) return project[1] + "/proposals";
    const first = this.lanes.flatMap((l) => l.cards)[0];
    return first ? first.path.replace(/\/[^/]*$/, "") : null;
  }

  /** A new proposal at the top of a column, its note written with the column's status. */
  async create(lane, text) {
    const dir = this.proposalsDir();
    const title = text
      .replace(/[\\/:*?"<>|#^[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!dir || !title)
      return new Notice("Uraeda: this board has no folder of proposals to add to.");
    let path = `${dir}/${title}.md`;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++)
      path = `${dir}/${title} ${n}.md`;
    const fresh = {};
    const rank = placeAt(lane.cards, fresh, 0).get(fresh);
    try {
      await this.app.vault.create(path, `---\nstatus: ${lane.status}\nrank: ${rank}\n---\n`);
    } catch (e) {
      new Notice("Uraeda: the proposal was not added: " + (e && e.message ? e.message : e), 8000);
    }
  }

  renderCard(lane, card) {
    const el = lane.listEl.createDiv({
      cls: "uraeda-card",
      attr: { tabindex: "0", role: "button", "data-path": card.path },
    });
    // A card with a branch or a Done button has a head line for them; one without has none, and its
    // menu button floats beside the title, so the card is only as tall as its title.
    const started = lane.status === "started";
    const head = card.branch || started ? el.createDiv("uraeda-card-head") : null;
    if (head) {
      if (card.branch) chip(head, "git-branch", card.branch, "is-branch");
      head.createSpan("uraeda-spacer");
    }
    const title = el.createDiv("uraeda-card-title");
    const button = (parent, cls, icon, label, text) => {
      const b = parent.createEl("button", {
        cls: "uraeda-card-btn " + cls,
        attr: { "aria-label": label },
      });
      setIcon(b.createSpan("uraeda-card-btn-icon"), icon);
      if (text) b.createSpan({ text });
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      return b;
    };
    if (started)
      button(head, "is-done", "check", "Mark done", "Done").addEventListener("click", (e) => {
        e.stopPropagation();
        this.markDone(card, el);
      });
    button(head || title, "is-more", "more-horizontal", "More").addEventListener("click", (e) => {
      e.stopPropagation();
      this.menu(card).showAtMouseEvent(e);
    });
    title.appendText(card.title);
    el.addEventListener("pointerdown", (e) => this.press(e, card, el, lane));
    el.addEventListener("click", (e) => {
      if (!this.suppress) this.app.workspace.openLinkText(card.path, "", Keymap.isModEvent(e));
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target === el)
        this.app.workspace.openLinkText(card.path, "", Keymap.isModEvent(e));
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (e.pointerType !== "touch") this.menu(card).showAtMouseEvent(e);
    });
  }

  menu(card) {
    const menu = new Menu();
    const open = (title, icon, where) =>
      menu.addItem((i) =>
        i
          .setTitle(title)
          .setIcon(icon)
          .onClick(() => this.app.workspace.openLinkText(card.path, "", where)),
      );
    open("Open", "file-text", false);
    open("Open in new tab", "file-plus", "tab");
    menu.addSeparator();
    if (card.status !== "done")
      menu.addItem((i) =>
        i
          .setTitle("Mark done")
          .setIcon("check")
          .onClick(() => this.markDone(card)),
      );
    for (const [status, label] of COLUMNS) {
      if (status === card.status || status === "done") continue;
      menu.addItem((i) =>
        i
          .setTitle("Move to " + label)
          .setIcon("arrow-right")
          .onClick(() => this.moveTo(card, status, "end")),
      );
    }
    return menu;
  }

  /** A card is done at the top of the done column, the latest first. */
  async markDone(card, el) {
    if (el && !QUIET())
      await el
        .animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateX(24px) scale(.97)" },
          ],
          { duration: 160, easing: "ease-in", fill: "forwards" },
        )
        .finished.catch(() => {});
    this.moveTo(card, "done", "top");
  }

  moveTo(card, status, where) {
    const lane = this.lanes.find((l) => l.status === status);
    if (!lane) return;
    const column = lane.cards.filter((c) => c !== card);
    return this.place(card, status, where === "top" ? 0 : column.length);
  }

  /** Puts a card at `index` of a column, its note and the ranks that change written. */
  async place(card, status, index) {
    const lane = this.lanes.find((l) => l.status === status);
    const column = lane.cards.filter((c) => c !== card);
    const ranks = placeAt(column, card, index);
    const now = Date.now();
    for (const [c, rank] of ranks)
      this.pending.set(c.path, { status: c === card ? status : c.status, rank, at: now });
    this.render();
    try {
      await Promise.all(
        [...ranks].map(([c, rank]) =>
          this.app.fileManager.processFrontMatter(c.file, (fm) => {
            if (c === card) fm.status = status;
            fm.rank = rank;
          }),
        ),
      );
    } catch (e) {
      for (const c of ranks.keys()) this.pending.delete(c.path);
      new Notice("Uraeda: a card was not saved: " + (e && e.message ? e.message : e), 8000);
      this.render();
    }
  }

  // Dragging: a mouse drags a card after a few pixels, a finger after it rests on the card for a
  // moment, and a finger that moves before then scrolls the board.

  press(e, card, el, lane) {
    if (this.drag || this.hold) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const hold = {
      card,
      el,
      lane,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
    };
    hold.touch = e.pointerType !== "mouse";
    hold.timer = hold.touch ? window.setTimeout(() => this.lift(), 320) : 0;
    this.hold = hold;
    const doc = el.ownerDocument;
    this.listeners = [
      ["pointermove", (ev) => this.moved(ev)],
      ["pointerup", (ev) => this.released(ev, false)],
      ["pointercancel", (ev) => this.released(ev, true)],
      ["keydown", (ev) => ev.key === "Escape" && this.released(ev, true)],
    ];
    for (const [type, fn] of this.listeners) doc.addEventListener(type, fn);
    this.doc = doc;
  }

  release() {
    if (this.hold) window.clearTimeout(this.hold.timer);
    this.hold = null;
    for (const [type, fn] of this.listeners || []) this.doc.removeEventListener(type, fn);
    this.listeners = null;
  }

  moved(e) {
    const { hold, drag } = this;
    if (!hold || (e.pointerId !== undefined && e.pointerId !== hold.id)) return;
    hold.lx = e.clientX;
    hold.ly = e.clientY;
    if (drag) return this.follow();
    const far = Math.hypot(e.clientX - hold.x, e.clientY - hold.y);
    if (hold.touch && far > 10) this.release();
    else if (!hold.touch && far > 5) this.lift();
  }

  released(e, cancelled) {
    if (e.pointerId !== undefined && this.hold && e.pointerId !== this.hold.id) return;
    const drag = this.drag;
    this.release();
    if (drag) this.drop(drag, cancelled);
  }

  lift() {
    const { hold } = this;
    if (!hold || this.drag) return;
    const { el, card, lane } = hold;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add("is-ghost");
    ghost.removeAttribute("tabindex");
    Object.assign(ghost.style, { width: rect.width + "px", height: rect.height + "px" });
    el.ownerDocument.body.appendChild(ghost);
    const slot = createDiv("uraeda-card-slot");
    slot.style.height = rect.height + "px";
    el.parentElement.insertBefore(slot, el);
    el.classList.add("is-held");
    this.rootEl.addClass("is-dragging");
    const index = lane.cards.indexOf(card);
    // The drag is the press itself, so the pointer's position, which the press keeps, is its own.
    this.drag = Object.assign(hold, {
      ghost,
      slot,
      offX: hold.x - rect.left,
      offY: hold.y - rect.top,
      origin: { lane, index },
      target: { lane, index },
    });
    window.clearTimeout(hold.timer);
    navigator.vibrate?.(12);
    ghost.animate?.(
      [
        { transform: this.ghostAt(hold.lx, hold.ly, 0) },
        { transform: this.ghostAt(hold.lx, hold.ly, 1.2) },
      ],
      { duration: 120, easing: "ease-out" },
    );
    this.follow();
    this.scrolling();
  }

  ghostAt(x, y, tilt) {
    const d = this.drag;
    return `translate(${x - d.offX}px, ${y - d.offY}px) rotate(${tilt}deg)`;
  }

  follow() {
    const d = this.drag;
    d.ghost.style.transform = this.ghostAt(d.lx, d.ly, 1.2);
    this.retarget();
  }

  /** Where the held card would land: the column under the pointer, and the place among its cards. */
  retarget() {
    const d = this.drag;
    let lane = null;
    let nearest = Infinity;
    for (const l of this.lanes) {
      if (!l.droppable) continue;
      const r = l.el.getBoundingClientRect();
      const away = d.lx < r.left ? r.left - d.lx : d.lx > r.right ? d.lx - r.right : 0;
      if (away < nearest) [lane, nearest] = [l, away];
    }
    const cards = [...lane.listEl.querySelectorAll(":scope > .uraeda-card:not(.is-held)")];
    const index = cards.filter((c) => {
      const r = c.getBoundingClientRect();
      return d.ly > r.top + r.height / 2;
    }).length;
    if (lane === d.target.lane && index === d.target.index) return;
    const all = [...this.rootEl.querySelectorAll(".uraeda-card:not(.is-held)")];
    flip(all, () => lane.listEl.insertBefore(d.slot, cards[index] || null));
    d.target = { lane, index };
  }

  /** The board scrolls while a card is held near its edge. */
  scrolling() {
    const d = this.drag;
    if (!d) return;
    const r = this.rootEl.getBoundingClientRect();
    const edge = 56;
    const push = (at, low, high) =>
      at < low + edge
        ? -((low + edge - at) / edge) * 16
        : at > high - edge
          ? ((at - (high - edge)) / edge) * 16
          : 0;
    const dx = push(d.lx, r.left, r.right);
    const dy = push(d.ly, r.top, r.bottom);
    if (dx || dy) {
      this.rootEl.scrollBy(dx, dy);
      this.retarget();
    }
    d.frame = window.requestAnimationFrame(() => this.scrolling());
  }

  /** The card lands where its slot is, or goes back where it was, and the board is drawn again. */
  async drop(d, cancelled) {
    this.drag = null;
    window.cancelAnimationFrame(d.frame);
    const { lane, index } = d.target;
    const moved = !cancelled && (lane !== d.origin.lane || index !== d.origin.index);
    const to = (cancelled ? d.el : d.slot).getBoundingClientRect();
    const from = d.ghost.style.transform;
    if (!QUIET() && d.ghost.animate)
      await d.ghost
        .animate(
          [{ transform: from }, { transform: `translate(${to.left}px, ${to.top}px) rotate(0deg)` }],
          { duration: 140, easing: "ease-out" },
        )
        .finished.catch(() => {});
    d.ghost.remove();
    d.slot.remove();
    d.el.classList.remove("is-held");
    this.rootEl.removeClass("is-dragging");
    this.suppress = true;
    window.setTimeout(() => (this.suppress = false), 60);
    if (moved) this.place(d.card, lane.status, index);
    else this.render();
  }
}

/** A project's folder name as a title: `go-coach` is `Go coach`. */
function projectTitle(name) {
  const text = name.replace(/[-_]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ago(time) {
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d ago`;
  if (days < 60) return `${Math.round(days / 7)} wk ago`;
  return `${Math.round(days / 30)} mo ago`;
}

/** The home: the projects with something to do, the latest touched first, each leading to its board. */
class HomeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return HOME_TYPE;
  }

  getDisplayText() {
    return "Home";
  }

  getIcon() {
    return "sprout";
  }

  async onOpen() {
    this.contentEl.addClass("uraeda-home");
    let timer = 0;
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.isShown() && this.render(), 400);
    };
    this.register(() => window.clearTimeout(timer));
    this.registerEvent(this.app.metadataCache.on("changed", later));
    for (const name of ["create", "delete", "rename"])
      this.registerEvent(this.app.vault.on(name, later));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => leaf === this.leaf && later()),
    );
    this.registerInterval(window.setInterval(later, 60 * 1000));
    this.render();
  }

  isShown() {
    return this.contentEl.isShown();
  }

  /** Projects with a proposal that is started, now, or next, by when a note of theirs last changed. */
  projects() {
    const byName = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const m = file.path.match(/^projects\/([^/]+)\/(.+)$/);
      if (!m) continue;
      if (!byName.has(m[1])) byName.set(m[1], { name: m[1], touched: 0, proposals: [] });
      const project = byName.get(m[1]);
      project.touched = Math.max(project.touched, file.stat.mtime);
      if (/^proposals\/[^/]+\.md$/.test(m[2])) project.proposals.push(proposal(this.app, file));
    }
    const order = (c) => ACTIVE.indexOf(c.status);
    return [...byName.values()]
      .map((p) => ({
        ...p,
        active: p.proposals
          .filter((c) => order(c) >= 0)
          .sort((a, b) => order(a) - order(b) || byRank(a, b)),
      }))
      .filter((p) => p.active.length)
      .sort((a, b) => b.touched - a.touched);
  }

  render() {
    const { contentEl } = this;
    const top = contentEl.scrollTop;
    contentEl.empty();
    const page = contentEl.createDiv("uraeda-home-page");
    const projects = this.projects();
    const head = page.createDiv("uraeda-home-head");
    const title = head.createDiv("uraeda-home-title");
    setIcon(title.createSpan("uraeda-home-mark"), "sprout");
    title.createEl("h1", { text: "Uraeda" });
    const count = projects.length;
    head.createDiv({
      cls: "uraeda-home-sub",
      text: count
        ? `${count} active project${count === 1 ? "" : "s"}, the latest touched first`
        : "Nothing is active",
    });
    if (this.plugin.base()) {
      const waiting = head.createEl("button", { cls: "uraeda-home-waiting" });
      setIcon(waiting.createSpan(), "inbox");
      waiting.createSpan({ text: "What waits on you" });
      waiting.addEventListener("click", () => this.plugin.open(""));
    }
    const grid = page.createDiv("uraeda-projects");
    projects.forEach((p, i) => this.renderProject(grid, p, i));
    if (!count)
      grid.createDiv({
        cls: "uraeda-home-empty",
        text: "A project shows here when one of its proposals is now, next, or started.",
      });
    contentEl.scrollTop = top;
  }

  renderProject(grid, project, index) {
    const el = grid.createDiv({ cls: "uraeda-project", attr: { tabindex: "0", role: "link" } });
    el.style.setProperty("--i", String(index));
    const head = el.createDiv("uraeda-project-head");
    head.createSpan({ cls: "uraeda-project-name", text: projectTitle(project.name) });
    head.createSpan({ cls: "uraeda-project-time", text: ago(project.touched) });
    const counts = el.createDiv("uraeda-project-counts");
    for (const status of ACTIVE) {
      const n = project.active.filter((c) => c.status === status).length;
      if (n)
        counts.createSpan({
          cls: "uraeda-pill",
          text: `${n} ${status}`,
          attr: { "data-status": status },
        });
    }
    const list = el.createEl("ul", "uraeda-project-list");
    for (const card of project.active.slice(0, 4)) {
      const item = list.createEl("li", { attr: { "data-status": card.status } });
      item.createSpan("uraeda-dot");
      item.createSpan({ cls: "uraeda-project-item", text: card.title });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.app.workspace.openLinkText(card.path, "", Keymap.isModEvent(e));
      });
    }
    if (project.active.length > 4)
      list.createEl("li", {
        cls: "uraeda-project-more",
        text: `and ${project.active.length - 4} more`,
      });
    const foot = el.createDiv("uraeda-project-foot");
    foot.createSpan({ text: "Open the board" });
    setIcon(foot.createSpan(), "arrow-right");
    const go = (e) => {
      const board = this.app.vault.getAbstractFileByPath(`projects/${project.name}/Board.base`);
      const leaf = Keymap.isModEvent(e) ? this.app.workspace.getLeaf("tab") : this.leaf;
      leaf.openFile(board || project.active[0].file);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => e.key === "Enter" && go(e));
  }
}
