// The pages of `ura serve`. Every page reads without this script: it saves what the human picks
// and types as they go, shows a follow-up when its answer calls for it, and keeps the step's bar
// in view. Every write is a POST of JSON to an address relative to the page.
"use strict";

(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /** POSTs `body` as JSON to `path`; resolves to the answer's JSON, or throws its message. */
  async function post(path, body) {
    let response;
    try {
      response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
    } catch (_) {
      throw new Error("Not saved: no connection. It will be saved when you change it again.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Not saved.");
      error.stale = response.status === 409;
      throw error;
    }
    return data;
  }

  /** Says `text` in a part's status line; a stale file offers a reload. */
  function say(line, text, error) {
    if (!line) return;
    line.textContent = text;
    line.classList.toggle("error", Boolean(error));
    if (error && error.stale) {
      const reload = document.createElement("button");
      reload.type = "button";
      reload.textContent = "Reload";
      reload.addEventListener("click", () => location.reload());
      line.append(" ", reload);
    }
  }

  /** Runs `fn` once `wait` ms after the last call; `now()` runs it at once. */
  function debounce(fn, wait) {
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = null;
      fn();
    };
    const call = () => {
      clearTimeout(timer);
      timer = setTimeout(run, wait);
    };
    call.now = () => {
      if (timer !== null) run();
    };
    return call;
  }

  // --- The round -------------------------------------------------------------------------------

  const round = $("main.round");
  if (round && round.dataset.waiting === "true") roundPage(round);

  // --- Mockups -------------------------------------------------------------------------------

  /**
   * Gives each link to an HTML mockup of the feature a "See it" button that draws it in place,
   * with "Pick an element" and "Comment on it". `comment(block, prefix)` opens the comment of the
   * block the link is in, its text starting with `prefix`: `Mockup mockups/menu.html, button
   * “Weekly”: `.
   */
  function mockups(main, comment) {
    const links = $$('a[href*="raw/"]', main).filter((a) =>
      /\.html?(#.*)?$/.test(a.getAttribute("href")),
    );
    for (const link of links) {
      const block = link.closest("[data-lines], .choice, p, li") || link.parentElement;
      if (block.querySelector(":scope > .see-it")) continue;
      const href = link.getAttribute("href");
      const match = /raw\/specs\/[^/]+\/(.+?)(#.*)?$/.exec(href);
      const file = decodeURIComponent(match ? match[1] : href.split("/").pop());
      const button = document.createElement("button");
      button.type = "button";
      button.className = "see-it";
      button.textContent = "See it";
      button.setAttribute("aria-expanded", "false");
      block.append(button);
      let box = null;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (box) {
          box.remove();
          box = null;
          button.textContent = "See it";
          button.setAttribute("aria-expanded", "false");
          return;
        }
        box = frame(href, file, (picked) =>
          comment(block, picked ? `Mockup ${file}, ${picked}: ` : `Mockup ${file}: `),
        );
        button.after(box);
        button.textContent = "Hide it";
        button.setAttribute("aria-expanded", "true");
      });
    }
  }

  /** A mockup drawn in a frame, with its controls. `comment(picked)` starts a comment. */
  function frame(href, file, comment) {
    const box = document.createElement("div");
    box.className = "frame";
    box.innerHTML =
      '<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals" loading="lazy"></iframe>' +
      '<div class="row"><button type="button" class="pick">Pick an element</button>' +
      '<button type="button" class="about">Comment on it</button>' +
      '<a class="button" target="_blank" rel="noopener">Open alone</a></div>' +
      '<p class="picking small muted" hidden>Tap the element to comment on.</p>';
    const iframe = $("iframe", box);
    iframe.src = href;
    iframe.title = `Mockup ${file}`;
    $("a", box).href = href;
    const pick = $(".pick", box);
    const hint = $(".picking", box);
    let picking = false;
    const setPicking = (on) => {
      picking = on;
      pick.textContent = on ? "Stop picking" : "Pick an element";
      hint.hidden = !on;
      if (iframe.contentWindow) iframe.contentWindow.postMessage({ uraeda: "pick", on }, "*");
    };
    pick.addEventListener("click", (event) => {
      event.stopPropagation();
      setPicking(!picking);
    });
    $(".about", box).addEventListener("click", (event) => {
      event.stopPropagation();
      comment(null);
    });
    box.addEventListener("click", (event) => event.stopPropagation());
    addEventListener("message", (event) => {
      if (event.source !== iframe.contentWindow || !event.data || !event.data.uraeda) return;
      const data = event.data;
      if (data.uraeda === "size") {
        iframe.style.height = `${Math.min(Math.max(data.height, 160), innerHeight * 0.8)}px`;
      } else if (data.uraeda === "picked") {
        setPicking(false);
        const name = (data.name || data.text || "").trim().slice(0, 60);
        comment(name ? `${data.role || "element"} “${name}”` : data.role || "an element");
      } else if (data.uraeda === "pick-stopped") {
        setPicking(false);
      }
    });
    return box;
  }

  /** Puts `prefix` on a new line at the end of `field`, and the caret after it. */
  function startWith(field, prefix) {
    const before = field.value.trimEnd();
    field.value = before ? `${before}\n${prefix}` : prefix;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    field.dispatchEvent(new Event("input"));
  }

  // --- The settings ----------------------------------------------------------------------------

  const settingsMain = $("main.settings[data-version]");
  if (settingsMain) settingsPage(settingsMain);

  function settingsPage(main) {
    const line = $(".saved", main);
    let version = main.dataset.version;
    let saving = Promise.resolve();
    const queue = (work) => (saving = saving.then(work));
    const { agents, marks } = JSON.parse($("#providers", main).textContent);
    const agentOf = (id) => agents.find((a) => a.id === id);
    const modelOf = (agent, id) =>
      agent && agent.models.find((m) => m.slug === id || m.aliases.includes(id));
    const usualModel = (agent) => agent && (agent.models.find((m) => m.default) || agent.models[0]);
    const markOf = (id) => marks[id === "command" || id === "" ? id : agentOf(id) ? id : "other"];

    function write(path, body) {
      return queue(async () => {
        say(line, "Saving…");
        try {
          const data = await post(path, { ...body, version });
          version = data.version;
          say(line, "Saved");
        } catch (error) {
          say(line, error.message, error);
        }
      });
    }

    /** A row drawn again from its pick, its `data-` values. */
    function drawRow(row) {
      const { agent, model, effort } = row.dataset;
      $(".mark", row).innerHTML = markOf(agent);
      const effortBox = $(".effort", row);
      if (agent === "command") {
        const command = row.closest("li.reviewer").dataset.command;
        $(".what", row).textContent = command || "A command";
        if (effortBox) effortBox.hidden = true;
        return;
      }
      if (effortBox) effortBox.hidden = false;
      const a = agentOf(agent);
      const m = modelOf(a, model);
      let name;
      if (!a) name = agent ? `${agent} (not listed)` : "Default";
      else if (!model) {
        const usual = a.models.find((x) => x.default);
        name = usual ? `${usual.name} · default` : a.name;
      } else name = m ? m.name : `${model} (not offered)`;
      $(".what", row).textContent = name;
      const shown = m || usualModel(a);
      const efforts = shown ? shown.efforts : [];
      const at = effort
        ? efforts.findIndex((e) => e.id === effort)
        : efforts.findIndex((e) => e.default);
      const meter = $(".meter", row);
      meter.innerHTML = "";
      efforts.forEach((_, i) => {
        const cell = document.createElement("i");
        if (at >= 0 && i <= at) cell.className = "on";
        meter.append(cell);
      });
      $(".effort-name", row).textContent = at >= 0 ? efforts[at].label : effort;
      effortBox.classList.toggle("usual", !effort);
    }

    function collect() {
      const pickOf = (row) => ({
        agent: row.dataset.agent === "command" ? "" : row.dataset.agent,
        model: row.dataset.model || "",
        effort: row.dataset.effort || "",
      });
      const steps = $$("li.step", main).map((step) => {
        const cut = $(`button.cut[data-step="${step.dataset.step}"]`, main);
        return {
          step: step.dataset.step,
          ...pickOf($(":scope > .row", step)),
          new_session: cut ? cut.getAttribute("aria-pressed") === "true" : false,
        };
      });
      const implementers = pickOf($(".implementers .row", main));
      const reviewers = $$(".reviewers > li.reviewer", main).map((item) => {
        const row = $(".row", item);
        const command = row.dataset.agent === "command";
        return {
          ...pickOf(row),
          instructions: command ? "" : item.dataset.instructions,
          command: command ? item.dataset.command : "",
        };
      });
      const chosen = $('.depth [aria-checked="true"]', main);
      return { steps, implementers, reviewers, depth: chosen ? chosen.dataset.depth : "waves" };
    }

    const saveRuns = () => write("settings/runs", { options: collect() });
    const typed = debounce(saveRuns, 600);

    // --- The picker: the agents as marks, the agent's models, the model's efforts.
    const dialog = $("dialog.picker", main);
    const body = $(".picker-body", dialog);

    const button = (label, pressed, act, role = "radio") => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", role);
      b.setAttribute("aria-checked", String(pressed));
      if (typeof label === "string") b.textContent = label;
      else b.append(...label);
      b.addEventListener("click", (event) => {
        event.preventDefault();
        act();
      });
      return b;
    };
    const section = (title, className, children) => {
      const box = document.createElement("section");
      box.className = className;
      const head = document.createElement("h3");
      head.textContent = title;
      const group = document.createElement("div");
      group.className = "choices-of";
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", title);
      group.append(...children);
      box.append(head, group);
      return box;
    };
    const markSpan = (id) => {
      const span = document.createElement("span");
      span.className = "mark";
      span.innerHTML = markOf(id);
      return span;
    };
    const text = (value, className) => {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = value;
      return span;
    };

    function openPicker(row) {
      const item = row.closest("li.reviewer");
      $("#picker-title", dialog).textContent = row.dataset.name;
      const change = (values) => {
        Object.assign(row.dataset, values);
        drawRow(row);
        saveRuns();
        render();
      };
      function render() {
        body.innerHTML = "";
        const { agent, model, effort } = row.dataset;
        if (item) {
          const command = agent === "command";
          body.append(
            section("Reviews with", "kinds-of segmented", [
              button("An agent", !command, () => change({ agent: "", model: "", effort: "" })),
              button("A command", command, () =>
                change({ agent: "command", model: "", effort: "" }),
              ),
            ]),
          );
          if (command) {
            const field = document.createElement("input");
            field.type = "text";
            field.className = "command-field";
            field.placeholder = "just review";
            field.value = item.dataset.command;
            field.setAttribute("aria-label", "The command, run in the feature's worktree");
            field.addEventListener("input", () => {
              item.dataset.command = field.value;
              drawRow(row);
              typed();
            });
            const box = document.createElement("section");
            box.append(text("Run in the feature's worktree", "hint muted small"), field);
            body.append(box);
            body.append(removeButton(item));
            return;
          }
        }
        const usualAgent = button([markSpan(""), text("Default", "label")], !agent, () =>
          change({ agent: "", model: "", effort: "" }),
        );
        const agentButtons = agents.map((a) => {
          const b = button([markSpan(a.id), text(a.name, "label")], agent === a.id, () =>
            change({ agent: a.id, model: "", effort: "" }),
          );
          if (a.problem) {
            b.disabled = true;
            b.title = a.problem;
          }
          return b;
        });
        body.append(section("Agent", "agents-of", [usualAgent, ...agentButtons]));
        const a = agentOf(agent);
        if (a) {
          const usual = usualModel(a);
          const current = modelOf(a, model);
          const models = [
            button(usual ? `Default · ${usual.name}` : "Default", !model, () =>
              change({ model: "", effort: "" }),
            ),
            ...a.models.map((m) =>
              button(m.name, current === m, () => {
                const keeps = m.efforts.some((e) => e.id === row.dataset.effort);
                change({ model: m.slug, effort: keeps ? row.dataset.effort : "" });
              }),
            ),
          ];
          body.append(section("Model", "models-of", models));
          const shown = current || usual;
          if (shown && shown.efforts.length) {
            const usualEffort = shown.efforts.find((e) => e.default);
            const efforts = [
              button(usualEffort ? `Default · ${usualEffort.label}` : "Default", !effort, () =>
                change({ effort: "" }),
              ),
              ...shown.efforts.map((e) =>
                button(e.label, effort === e.id, () => change({ effort: e.id })),
              ),
            ];
            body.append(section("Effort", "efforts-of segmented", efforts));
          }
        }
        if (item) {
          const field = document.createElement("textarea");
          field.rows = 2;
          field.value = item.dataset.instructions;
          field.setAttribute("aria-label", "Instructions for the reviewer, optional");
          field.placeholder = "Instructions, optional";
          field.addEventListener("input", () => {
            item.dataset.instructions = field.value;
            typed();
          });
          const box = document.createElement("section");
          box.append(field);
          body.append(box, removeButton(item));
        }
      }
      render();
      dialog.showModal();
    }

    function removeButton(item) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "remove-reviewer";
      b.textContent = "Remove this reviewer";
      b.addEventListener("click", (event) => {
        event.preventDefault();
        item.parentNode.removeChild(item);
        saveRuns();
        dialog.close();
      });
      return b;
    }

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => typed.now());

    main.addEventListener("change", (event) => {
      if (event.target.classList.contains("wake")) {
        write("settings/serve", { wake: event.target.checked });
      }
    });
    main.addEventListener("click", (event) => {
      const cut = event.target.closest("button.cut");
      if (cut) {
        const on = cut.getAttribute("aria-pressed") !== "true";
        cut.setAttribute("aria-pressed", String(on));
        $(".label", cut).textContent = on ? "✂ New session" : "Same session";
        saveRuns();
        return;
      }
      const depth = event.target.closest(".depth [data-depth]");
      if (depth) {
        for (const b of $$(".depth [data-depth]", main)) {
          b.setAttribute("aria-checked", String(b === depth));
        }
        saveRuns();
        return;
      }
      if (event.target.closest(".add-reviewer")) {
        const list = $(".reviewers", main);
        const item = $(".reviewer-template", main).content.firstElementChild.cloneNode(true);
        list.append(item);
        saveRuns();
        openPicker($(".row", item));
        return;
      }
      const row = event.target.closest("button.row");
      if (row && !dialog.contains(row)) openPicker(row);
    });
  }

  // --- The review ------------------------------------------------------------------------------

  const review = $("main.review");
  if (review) reviewPage(review);

  function reviewPage(main) {
    const data = JSON.parse($("#review-data").textContent);
    const file = location.pathname.split("/").pop();
    const what = main.dataset.what;
    const waiting = main.dataset.waiting === "true";
    const doc = $("article.doc", main);
    const blocks = $$("[data-lines]", doc);
    const range = (el) => el.dataset.lines.split("-").map(Number);
    let comments = data.comments;

    /** The smallest drawn block holding line `n`. */
    function blockAt(n) {
      let best = null;
      for (const el of blocks) {
        const [start, end] = range(el);
        if (start <= n && n <= end && (!best || end - start <= range(best)[1] - range(best)[0])) {
          best = el;
        }
      }
      return best;
    }

    for (const el of blocks) {
      const [start, end] = range(el);
      if (data.changed.some(([s, e]) => s <= end && start <= e) && !$("[data-lines]", el)) {
        el.classList.add("changed");
      }
    }

    for (const link of $$("[data-goto]", main)) {
      link.addEventListener("click", (event) => {
        const el = blockAt(Number(link.dataset.goto));
        if (!el) return;
        event.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
      });
    }

    const list = $(".comment-list", main);
    const none = $(".none", main);
    const count = $(".bar .count");

    function quote(c) {
      if (!c.start) return `On the whole ${what}`;
      const el = blockAt(c.start);
      const text = el ? el.textContent.trim().replace(/\s+/g, " ") : "";
      return text.length > 90 ? text.slice(0, 88) + "…" : text;
    }

    function draw() {
      for (const old of $$(".inline-comment", doc)) old.remove();
      list.innerHTML = "";
      none.hidden = comments.length > 0;
      if (count) count.textContent = comments.length;
      for (const c of comments) {
        const item = document.createElement("li");
        item.innerHTML =
          '<p class="quote small muted"></p><p class="text"></p>' +
          (waiting
            ? '<div class="row"><button type="button" class="show">Show</button><button type="button" class="edit">Edit</button><button type="button" class="remove">Remove</button></div>'
            : "");
        $(".quote", item).textContent = quote(c);
        $(".text", item).textContent = c.text;
        list.append(item);
        if (!waiting) continue;
        const el = c.start ? blockAt(c.start) : null;
        $(".show", item).hidden = !el;
        $(".show", item).addEventListener("click", () =>
          el.scrollIntoView({ behavior: "smooth", block: "center" }),
        );
        $(".edit", item).addEventListener("click", () =>
          form(item, c.text, (text) => send({ number: c.number, text, previous: c.text })),
        );
        $(".remove", item).addEventListener("click", () => {
          if (confirm("Remove this comment?"))
            send({ number: c.number, text: "", previous: c.text });
        });
        if (el) {
          const inline = document.createElement("div");
          inline.className = "inline-comment";
          inline.textContent = c.text;
          el.after(inline);
        }
      }
    }

    async function send(body) {
      try {
        const answer = await post(`${file}/comment`, { ...body, version: data.version });
        comments = answer.comments;
        draw();
        return true;
      } catch (error) {
        alert(error.message);
        return false;
      }
    }

    /** Opens a comment field after `el`, with `text`; `save` gets the text typed. */
    function form(el, text, save) {
      for (const open of $$(".comment-form", main)) open.remove();
      const box = document.createElement("div");
      box.className = "comment-form";
      box.innerHTML =
        '<textarea rows="3" aria-label="Your comment"></textarea><div class="row"><button type="button" class="primary save">Save comment</button><button type="button" class="cancel">Cancel</button></div>';
      const field = $("textarea", box);
      field.value = text;
      el.after(box);
      field.focus();
      box.scrollIntoView({ block: "nearest" });
      $(".cancel", box).addEventListener("click", () => box.remove());
      $(".save", box).addEventListener("click", async () => {
        if (!field.value.trim()) return field.focus();
        if (await save(field.value)) box.remove();
      });
    }

    if (waiting) {
      doc.addEventListener("click", (event) => {
        if (event.target.closest("a, .comment-form, .inline-comment, iframe, .frame, button"))
          return;
        const selected = String(getSelection()).trim();
        if (selected) return;
        const el = event.target.closest("[data-lines]");
        if (!el) return;
        const [start, end] = range(el);
        form(el, "", (text) => send({ lines: [start, end], text }));
      });

      // A selection inside the document comments on the lines it covers.
      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "primary pick-selection";
      pick.textContent = "Comment on the selection";
      pick.hidden = true;
      document.body.append(pick);
      const lineOf = (node) => {
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        const line = el && el.closest("[data-line]");
        if (line) return Number(line.dataset.line);
        const block = el && el.closest("[data-lines]");
        return block ? range(block)[0] : 0;
      };
      let chosen = null;
      document.addEventListener("selectionchange", () => {
        const selection = getSelection();
        const inside =
          selection.rangeCount &&
          !selection.isCollapsed &&
          doc.contains(selection.anchorNode) &&
          doc.contains(selection.focusNode);
        if (!inside) {
          pick.hidden = true;
          return;
        }
        const a = lineOf(selection.anchorNode);
        const b = lineOf(selection.focusNode);
        chosen = { start: Math.min(a, b), end: Math.max(a, b), node: selection.focusNode };
        pick.hidden = !chosen.start;
      });
      pick.addEventListener("mousedown", (event) => event.preventDefault());
      pick.addEventListener("click", () => {
        if (!chosen) return;
        const el = blockAt(chosen.end) || doc;
        const lines = [chosen.start, chosen.end];
        getSelection().removeAllRanges();
        pick.hidden = true;
        form(el, "", (text) => send({ lines, text }));
      });

      const general = $("details.general", main);
      if (general) {
        $(".save-general", general).addEventListener("click", async () => {
          const field = $("textarea", general);
          if (!field.value.trim()) return field.focus();
          if (await send({ lines: null, text: field.value })) {
            field.value = "";
            general.open = false;
          }
        });
      }

      const verdict = $("section.verdict", main);
      const finish = async (kind) => {
        const line = $(".saved", verdict);
        if (kind === "request-changes" && comments.length === 0) {
          say(
            line,
            "Say what to change first: comment on a passage, or on the whole " + what + ".",
            true,
          );
          return;
        }
        const question =
          kind === "approve"
            ? `Approve the ${what}? The agent goes on from it.`
            : `Ask for changes? The agent revises the ${what} from your comments.`;
        if (!confirm(question)) return;
        for (const b of $$("button", verdict)) b.disabled = true;
        try {
          const answer = await post(`${file}/verdict`, {
            verdict: kind,
            summary: $(".summary", verdict).value,
            version: data.version,
          });
          main.innerHTML = "";
          const done = document.createElement("section");
          done.className = "done";
          done.innerHTML =
            '<h1></h1><p></p><p><a class="button" href="../../../">Back to what waits on you</a></p>';
          $("h1", done).textContent =
            kind === "approve"
              ? `${what[0].toUpperCase()}${what.slice(1)} approved`
              : "Changes requested";
          $("p", done).textContent = answer.next;
          main.append(done);
          const bar = $(".bar");
          if (bar) bar.remove();
          pick.remove();
          window.scrollTo(0, 0);
        } catch (error) {
          for (const b of $$("button", verdict)) b.disabled = false;
          say(line, error.message, error);
        }
      };
      $(".approve", verdict).addEventListener("click", () => finish("approve"));
      $(".request", verdict).addEventListener("click", () => finish("request-changes"));
    }

    if (waiting) {
      mockups(doc, (block, prefix) => {
        const el = block.closest("[data-lines]") || block;
        const [start, end] = range(el);
        form(el, "", (text) => send({ lines: [start, end], text }));
        const field = $(".comment-form textarea", main);
        if (field) startWith(field, prefix);
      });
    }
    draw();
  }

  function roundPage(main) {
    const bar = $(".bar");
    const next = $(".next", bar);
    const send = $(".submit", bar);

    const questions = () => $$("section.q", main).filter((q) => !q.hidden);
    const answered = (q) => q.dataset.answer.trim() !== "";
    const picked = (q) =>
      $$(".choice", q)
        .filter((c) => c.getAttribute("aria-checked") === "true")
        .map((c) => c.dataset.letter);

    function progress() {
      const shown = questions();
      const done = shown.filter(answered).length;
      $(".count", bar).textContent = done;
      $(".total", bar).textContent = shown.length;
      const complete = done === shown.length;
      next.hidden = complete;
      send.hidden = !complete;
    }

    function followUps(q) {
      const letters = picked(q);
      for (const follow of $$(`section.q[data-parent="${q.dataset.id}"]`, main)) {
        follow.hidden = !letters.includes(follow.dataset.letter) && !answered(follow);
      }
    }

    // Every save of the page waits for the one before: each sends what the last one wrote.
    let saving = Promise.resolve();
    const queue = (work) => (saving = saving.then(work));
    const typing = [];

    for (const q of $$("section.q", main)) {
      const line = $(".saved", q);
      const words = $(".words textarea", q);
      const save = () => {
        queue(async () => {
          say(line, "Saving…");
          try {
            const data = await post("answer", {
              id: q.dataset.id,
              letters: picked(q),
              comment: words.value,
              previous: q.dataset.answer,
            });
            q.dataset.answer = data.answer;
            say(line, data.answer ? "Saved" : "Cleared");
          } catch (error) {
            say(line, error.message, error);
          }
          followUps(q);
          progress();
        });
      };
      const typed = debounce(save, 700);
      typing.push(typed);
      words.addEventListener("input", typed);
      words.addEventListener("blur", () => typed.now());

      for (const choice of $$(".choice", q)) {
        const toggle = (event) => {
          if (event.target.closest("a, iframe, .frame, button")) return;
          const on = choice.getAttribute("aria-checked") === "true";
          if (!q.dataset.combine) {
            if (on) return;
            for (const other of $$(".choice", q)) other.setAttribute("aria-checked", "false");
          }
          choice.setAttribute("aria-checked", String(!on));
          followUps(q);
          save();
        };
        choice.addEventListener("click", toggle);
        choice.addEventListener("keydown", (event) => {
          if (event.target !== choice) return;
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggle(event);
          }
        });
      }
    }

    next.addEventListener("click", () => {
      const open = questions().filter((q) => !answered(q));
      const below = open.find((q) => q.getBoundingClientRect().top > 80) || open[0];
      if (!below) return;
      below.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = $(".choice", below);
      if (first) first.focus({ preventScroll: true });
    });

    send.addEventListener("click", async () => {
      if (!confirm("Send your answers? The agent takes them from here.")) return;
      send.disabled = true;
      try {
        for (const typed of typing) typed.now();
        await saving;
        const data = await queue(() => post("submit", {}));
        main.innerHTML = "";
        const done = document.createElement("section");
        done.className = "done";
        done.innerHTML =
          '<h1>Answers sent</h1><p></p><p><a class="button" href="../../">Back to what waits on you</a></p>';
        $("p", done).textContent = data.next;
        main.append(done);
        bar.remove();
        window.scrollTo(0, 0);
      } catch (error) {
        send.disabled = false;
        alert(error.message);
      }
    });

    // The notes, and the comments on settled points.
    const notes = $("section.notes", main);
    if (notes) {
      const field = $("textarea", notes);
      const line = $(".saved", notes);
      const save = debounce(
        () =>
          queue(async () => {
            say(line, "Saving…");
            try {
              const data = await post("notes", {
                notes: field.value,
                previous: notes.dataset.answer,
              });
              notes.dataset.answer = data.notes;
              say(line, "Saved");
            } catch (error) {
              say(line, error.message, error);
            }
          }),
        700,
      );
      typing.push(save);
      field.addEventListener("input", save);
      field.addEventListener("blur", () => save.now());
    }
    for (const point of $$(".point", main)) {
      const field = $("textarea", point);
      if (!field) continue;
      const line = $(".saved", point);
      const save = debounce(
        () =>
          queue(async () => {
            say(line, "Saving…");
            try {
              const data = await post("settled", {
                subject: point.dataset.subject,
                number: Number(point.dataset.number),
                text: field.value,
                previous: point.dataset.comment,
              });
              point.dataset.number = data.number;
              point.dataset.comment = data.text;
              say(line, data.text ? "Saved" : "Removed");
            } catch (error) {
              say(line, error.message, error);
            }
          }),
        700,
      );
      typing.push(save);
      field.addEventListener("input", save);
      field.addEventListener("blur", () => save.now());
    }

    mockups(main, (block, prefix) => {
      const q = block.closest("section.q");
      const field = q ? $(".words textarea", q) : $("section.notes textarea", main);
      if (field) startWith(field, prefix);
    });
    progress();
  }
})();
