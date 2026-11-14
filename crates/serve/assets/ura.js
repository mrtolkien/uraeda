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

    progress();
  }
})();
