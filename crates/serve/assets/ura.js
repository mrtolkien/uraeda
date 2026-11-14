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
          form(item, c.text, (text) => send({ number: c.number, text })),
        );
        $(".remove", item).addEventListener("click", () => {
          if (confirm("Remove this comment?")) send({ number: c.number, text: "" });
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
        const answer = await post(`${file}/comment`, body);
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

    for (const q of $$("section.q", main)) {
      const line = $(".saved", q);
      const words = $(".words textarea", q);
      let saving = Promise.resolve();
      const save = () => {
        saving = saving.then(async () => {
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
        const data = await post("submit", {});
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
      const save = debounce(async () => {
        say(line, "Saving…");
        try {
          const data = await post("notes", { notes: field.value, previous: notes.dataset.answer });
          notes.dataset.answer = data.notes;
          say(line, "Saved");
        } catch (error) {
          say(line, error.message, error);
        }
      }, 700);
      field.addEventListener("input", save);
      field.addEventListener("blur", () => save.now());
    }
    for (const point of $$(".point", main)) {
      const field = $("textarea", point);
      if (!field) continue;
      const line = $(".saved", point);
      const save = debounce(async () => {
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
      }, 700);
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
