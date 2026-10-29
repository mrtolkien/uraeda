// The decisions palette's ranking: an entry is found by its numeral or whole title, the start of
// its title or of a word in it, anywhere in it, then in its first sentence; the best match first,
// ties in the list's order. SC-005 of the layout look: every entry of this repository's own ledger
// opens with three letters or fewer.
import { join } from "node:path";
import { readLedger } from "uraeda-binding";
import { fixture } from "uraeda-binding/test-utils";
import type { Ledger } from "uraeda-server/fate";
import { expect, test } from "vite-plus/test";
import { type JumpEntry, jumpEntries, pickerItemOf, searchEntries } from "../decisions/jump.ts";

/** A decision's entry, with its title and its first sentence. */
const decision = (title: string, summary: string | null = null) =>
  ({ kind: "decision", path: `/decisions/${title}`, summary, title }) as unknown as JumpEntry;

/** A principle's entry, with its numeral and title. */
const principle = (number: string, title: string) =>
  ({
    kind: "principle",
    path: "/decisions/constitution",
    principle: { number, title },
    summary: null,
    title,
  }) as unknown as JumpEntry;

/** The titles `query` finds in `entries`, the best first. */
const found = (entries: Array<JumpEntry>, query: string) =>
  searchEntries(entries, query).map((entry) => entry.title);

test("the best match comes first: the whole title, its start, a word's start, inside, the sentence", () => {
  const entries = [
    decision("Code quality", "Keeps the tests small."),
    decision("The sandbox"),
    decision("Sandbox picks"),
    decision("Sand"),
    decision("Unsandboxed"),
  ];

  expect(found(entries, "sand")).toEqual(["Sand", "Sandbox picks", "The sandbox", "Unsandboxed"]);
  expect(found(entries, "tests")).toEqual(["Code quality"]);
});

test("a principle opens by its numeral, before a title that starts with the same letters", () => {
  const entries = [decision("Iconography"), principle("I", "Humans stay in control")];

  expect(found(entries, "i")).toEqual(["Humans stay in control", "Iconography"]);
});

test("words split at spaces and hyphens, and ties keep the list's order", () => {
  const entries = [decision("A to Z"), decision("Pull-request body"), decision("The request")];

  expect(found(entries, "req")).toEqual(["Pull-request body", "The request"]);
});

test.each([
  ["no query lists them all", "", ["B", "A"]],
  ["blanks list them all", "   ", ["B", "A"]],
  ["a query is trimmed and in any case", "  A ", ["A"]],
  ["nothing matches", "zzz", []],
])("%s", (_, query, titles) => {
  expect(found([decision("B"), decision("A")], query)).toEqual(titles);
});

test("the entries are the principles, then the decisions in the order given", () => {
  const ledger = {
    constitution: {
      document: { blocks: [] },
      principles: [{ blocks: [], number: "I", slug: "humans", title: "Humans" }],
    },
  } as unknown as Pick<Ledger, "constitution">;
  const decisions = [
    { name: "testing", summary: "How tests.", title: "Testing" },
    { name: "sandbox", summary: null, title: "Sandbox" },
  ] as unknown as Ledger["decisions"];

  expect(
    jumpEntries(ledger, decisions).map(({ path, summary, title }) => [path, summary, title]),
  ).toEqual([
    ["/decisions/constitution", null, "Humans"],
    ["/decisions/testing", "How tests.", "Testing"],
    ["/decisions/sandbox", null, "Sandbox"],
  ]);
});

/** This repository's own ledger, read from its default branch, as the page receives it. */
async function ownLedger() {
  const ledger = await readLedger(join(fixture("."), ".."));
  const decisions = ledger.decisions.map((entry) => ({
    ...entry,
    icon: entry.icon ?? null,
    summary: entry.summary ?? null,
  })) as unknown as Ledger["decisions"];
  return { constitution: ledger.constitution as unknown as Ledger["constitution"], decisions };
}

/** The queries of one to three letters an entry's title holds, its words' starts first. */
function shortQueries(title: string): Array<string> {
  const text = title.toLowerCase();
  const queries = new Set<string>();
  for (let length = 1; length <= 3; length += 1) {
    for (let start = 0; start + length <= text.length; start += 1) {
      queries.add(text.slice(start, start + length));
    }
  }
  return [...queries].filter((query) => query.trim() === query);
}

test("every entry of this repository's ledger is first for a query of three letters (SC-005)", async () => {
  const { constitution, decisions } = await ownLedger();
  const entries = jumpEntries({ constitution }, decisions);
  expect(entries.length).toBeGreaterThanOrEqual(30);
  const unreachable = entries
    .filter(
      (entry) =>
        !shortQueries(entry.title).some((query) => searchEntries(entries, query)[0] === entry),
    )
    .map((entry) => entry.title);
  expect(unreachable).toEqual([]);
});

test("each entry is its own row in the picker, though every principle opens the constitution", async () => {
  const { constitution, decisions } = await ownLedger();
  const items = jumpEntries({ constitution }, decisions).map(pickerItemOf);
  expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  expect(items.filter((item) => item.path === "/decisions/constitution").length).toBeGreaterThan(1);
});
