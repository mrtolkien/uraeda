// The gallery's texts: a spec that holds every kind of block and span the core reads, a long
// reply, and two diagrams, one Merman draws and one it cannot read.

export const SPEC = `# Recurring tasks

A task that comes back on its own: **daily**, *weekly*, or on a day of the month. Its next date
shows on its row, as \`Tomorrow\`, and a ~~manual copy~~ is never needed again. See the
[data model](specs/2026-10-06-recurring-tasks/data-model.md), the [scope](#scope), the
[[stack]] decision, or [the RFC](https://example.com/rfc) on the web.

## Scope

> [!IMPORTANT]
> A task repeats from the day it was **done**, not the day it was due: a late task does not
> pile up copies.

- [x] Repeat daily, weekly, and monthly
- [ ] Repeat on weekdays only
- [pro] One rule for every list
- [con] A rule cannot skip a holiday
- ? Does a paused task keep its next date?
- ! Changing a rule moves every future date

1. Read the rule.
2. Find the next date after today, from the day the task was done, even when that day is a
   month away and the line wraps.
3. Write it on the row.

### Rules, by kind

| Rule      | Next date                                  | Example         |
| :-------- | :----------------------------------------- | --------------: |
| Daily     | the day after it was done                  |       Tomorrow |
| Weekly    | the same weekday, a week after             |  Tuesday, 14:00 |
| Monthly   | the same day of the next month, or its last | 31 → 30 April |

> A quote, from the proposal: "I keep copying the same task every Monday."

\`\`\`ts
// The next date of a rule, from the day a task was done.
export function next(rule: Rule, done: Date): Date {
  const day = 24 * 60 * 60 * 1000;
  if (rule.kind === "daily") return new Date(done.getTime() + day);
  return addMonths(done, rule.kind === "monthly" ? 1 : 0);
}
\`\`\`

The prototype of the row, alone in its paragraph, draws in place:

[The row's prototype](specs/2026-10-06-recurring-tasks/mockups/row.svg)

---

<details>
<summary>Raw HTML is shown as it is written.</summary>
</details>
`;

export const DIAGRAMS = `A flow Merman draws:

\`\`\`mermaid
flowchart LR
  A[Proposal] --> B{Questions?}
  B -- Yes --> C[Round]
  B -- No --> D[Spec]
  C --> D
\`\`\`

And one it cannot read, which shows its source:

\`\`\`mermaid
flowchart LR
  A[Proposal --> ((
\`\`\`
`;

/** A reply of `sections` parts, each a heading, prose, a list, and code: a long one. */
export function longReply(sections: number): string {
  return Array.from(
    { length: sections },
    (_, at) => `## Step ${at + 1}

I read \`crates/app/src/reply.rs\` again, and the splitter keeps only the block being written,
so a long reply costs no more per piece than a short one. Here is what changes in step ${at + 1}.

- The paragraph ends at a blank line.
- A list goes on across blank lines, and ends at the first line that is neither indented nor an
  item.

\`\`\`rust
fn step_${at + 1}(text: &str) -> usize {
    text.lines().filter(|line| line.trim().is_empty()).count()
}
\`\`\`
`,
  ).join("\n");
}

/** A small picture, for the prototype's link: a row with its date. */
export const ROW_SVG = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="96" viewBox="0 0 560 96"><rect width="560" height="96" fill="#313244"/><rect x="16" y="28" width="40" height="40" fill="#89b4fa"/><rect x="72" y="32" width="300" height="14" fill="#cdd6f4"/><rect x="72" y="56" width="180" height="10" fill="#a6adc8"/><rect x="440" y="38" width="100" height="20" fill="#a6e3a1"/></svg>`,
)}`;
