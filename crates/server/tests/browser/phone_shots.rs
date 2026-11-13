//! The phone's pictures and what each measures under a thumb, written to `report.txt` beside them.

use std::fmt::Write as _;
use std::time::Duration;

use serde_json::Value;

use super::super::cdp::Browser;

/// What the page measures under a thumb, as JSON: `small`, each pressable thing on top under 44
/// points, its name, width, and height; `cut`, text running past the screen's edge outside a
/// scroller of its own; `sideways`, a scroller as wide as the page that scrolls sideways; `tiny`,
/// text under 12 points; `prose`, the sizes of text of more than 80 characters.
const MEASURE: &str = r"(() => {
  const W = innerWidth, H = innerHeight;
  const words = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('role')
    || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 48);
  const shown = (el) => {
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1 || b.right <= 0 || b.bottom <= 0 || b.left >= W || b.top >= H) return null;
    return b;
  };
  const onTop = (el, b) => {
    const x = Math.min(W - 1, Math.max(0, b.left + b.width / 2));
    const y = Math.min(H - 1, Math.max(0, b.top + b.height / 2));
    const at = document.elementFromPoint(x, y);
    return at !== null && (el === at || el.contains(at));
  };
  // A press inside a press of its width that is a thumb's size, a field's editor in its frame, is
  // that press's: a tap beside it lands on the same thing.
  const held = (el, b) => {
    let up = el.parentElement;
    for (let level = 0; up && level < 8; level += 1, up = up.parentElement) {
      if (!up._pressable) continue;
      const a = up.getBoundingClientRect();
      // A control's size, a field's frame: a pane takes a press too, to take the focus.
      return a.height >= 43.5 && a.height <= 120 && a.width - b.width <= 24;
    }
    return false;
  };
  const small = [], covered = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el._pressable) continue;
    const b = shown(el);
    if (b === null) continue;
    if (!onTop(el, b)) {
      // Under something that is not what holds it: an overlay, a bar. Clipped by its scroller is not.
      const x = Math.min(W - 1, Math.max(0, b.left + b.width / 2));
      const y = Math.min(H - 1, Math.max(0, b.top + b.height / 2));
      const at = document.elementFromPoint(x, y);
      const whole = b.top >= 0 && b.bottom <= H;
      // A sheet's or a dialog's dim, as large as the window, covers the page on purpose.
      const dim = at && at.getBoundingClientRect().width >= W - 1 && at.getBoundingClientRect().height >= H * 0.8;
      if (whole && at && !dim && !at.contains(el) && !el.contains(at))
        covered.push(words(el));
      continue;
    }
    if ((b.width < 43.5 || b.height < 43.5) && !held(el, b))
      small.push([words(el), Math.round(b.width), Math.round(b.height)]);
  }
  const inScroller = (el) => {
    for (let up = el.parentElement; up; up = up.parentElement) {
      if (up.classList.contains('nsh-scroll') && up.scrollWidth > up.clientWidth + 1) return true;
      const ox = getComputedStyle(up).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  const cut = [], tiny = [], prose = {};
  for (const el of document.querySelectorAll('body *')) {
    if (el.childElementCount > 0) continue;
    const text = el.textContent.trim();
    if (text === '') continue;
    const b = shown(el);
    if (b === null) continue;
    if ((b.right > W + 1 || b.left < -1) && !inScroller(el)) cut.push(text.slice(0, 48));
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) tiny.push([text.slice(0, 32), size]);
    if (text.length > 80) prose[size] = (prose[size] ?? 0) + 1;
  }
  const sideways = [...document.querySelectorAll('.nsh-scroll')].filter((el) => {
    const b = shown(el);
    return b !== null && b.width >= W * 0.9 && el.scrollWidth > el.clientWidth + 1
      && getComputedStyle(el).overflowX !== 'hidden';
  }).map(words);
  // iOS zooms the page into a field whose text is under 16 points as it takes the focus.
  const fields = [...document.querySelectorAll('.nsh-field')].filter((el) => shown(el) !== null)
    .map((el) => parseFloat(getComputedStyle(el).fontSize)).filter((size) => size < 16);
  const probe = document.querySelector('.nsh-probe');
  const safe = probe ? [getComputedStyle(probe).paddingTop, getComputedStyle(probe).paddingBottom] : null;
  return { small, covered: [...new Set(covered)], cut: [...new Set(cut)], sideways, tiny, prose, safe, fields };
})()";

/// The report's part for one picture: what it measured, one line each.
fn report_of(name: &str, measured: &Value) -> String {
    let mut text = format!("## {name} (safe area {})\n", measured["safe"]);
    let list = |key: &str| measured[key].as_array().cloned().unwrap_or_default();
    for small in list("small") {
        let _ = writeln!(
            text,
            "  small  {:>3}x{:<3} {}",
            small[1], small[2], small[0]
        );
    }
    for covered in list("covered") {
        let _ = writeln!(text, "  covered {covered}");
    }
    for cut in list("cut") {
        let _ = writeln!(text, "  cut    {cut}");
    }
    for sideways in list("sideways") {
        let _ = writeln!(text, "  sideways {sideways}");
    }
    for tiny in list("tiny") {
        let _ = writeln!(text, "  tiny   {}pt {}", tiny[1], tiny[0]);
    }
    for size in list("fields") {
        let _ = writeln!(
            text,
            "  field  {size}pt text, under iOS's 16: the page zooms in"
        );
    }
    if let Some(prose) = measured["prose"]
        .as_object()
        .filter(|sizes| !sizes.is_empty())
    {
        let sizes: Vec<String> = prose
            .iter()
            .map(|(size, n)| format!("{size}pt x{n}"))
            .collect();
        let _ = writeln!(text, "  prose  {}", sizes.join(", "));
    }
    text
}

/// Pictures and their report, in `target/shots/phone/`, filtered by `URAEDA_SHOTS_WORD`.
pub struct Shots {
    folder: std::path::PathBuf,
    word: Option<String>,
    mode: String,
    pub report: String,
    /// Each picture's count of small targets, for the summary.
    pub small: usize,
}

impl Shots {
    pub fn new(mode: &str) -> Shots {
        let folder = super::super::shots();
        Shots {
            folder,
            word: std::env::var("URAEDA_SHOTS_WORD")
                .ok()
                .filter(|word| !word.is_empty()),
            mode: mode.to_owned(),
            report: String::new(),
            small: 0,
        }
    }

    /// The colour mode the pictures are taken in.
    pub fn mode(&self) -> &str {
        &self.mode
    }

    /// Whether the picture `name` is asked for.
    pub fn wants(&self, name: &str) -> bool {
        self.word
            .as_ref()
            .is_none_or(|word| name.contains(word.as_str()))
    }

    /// Takes the picture `name` of what the browser shows, and measures it.
    pub async fn take(&mut self, browser: &mut Browser, name: &str) {
        tokio::time::sleep(Duration::from_millis(700)).await;
        let file = format!("{name}-{}.png", self.mode);
        browser.picture(&self.folder.join(&file)).await;
        let measured = browser.evaluate(MEASURE).await;
        self.small += measured["small"].as_array().map_or(0, Vec::len);
        let part = report_of(&file, &measured);
        let mut kept = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.folder.join("report.txt"))
            .expect("the report opens");
        std::io::Write::write_all(&mut kept, part.as_bytes()).expect("the report is written");
        self.report.push_str(&part);
    }
}
