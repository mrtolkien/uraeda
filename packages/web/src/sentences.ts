import type { Span } from "uraeda-binding";

/**
 * A paragraph's spans split after its first sentence: the sentence's, and the rest's. The end is
 * the first ".", "!" or "?" before a space in plain text, not in code nor a link, the space perhaps
 * the next span's, as after a bold lead. None when the paragraph is one sentence.
 */
export function firstSentence(spans: ReadonlyArray<Span>): [Array<Span>, Array<Span>] | undefined {
  for (const [index, span] of spans.entries()) {
    if (span.code || span.link || span.image) {
      continue;
    }
    const next = spans[index + 1];
    const end =
      /[.!?](?=\s)/.exec(span.text) ??
      (/\s/.test(next?.text[0] ?? "") ? /[.!?]$/.exec(span.text) : null);
    if (end) {
      const at = end.index + 1;
      const rest = [{ ...span, text: span.text.slice(at).trimStart() }, ...spans.slice(index + 1)];
      return rest.some((one) => one.text !== "" || one.image)
        ? [[...spans.slice(0, index), { ...span, text: span.text.slice(0, at) }], rest]
        : undefined;
    }
  }
  return undefined;
}

/** Spans split into their sentences, as `firstSentence` ends the first. */
export function sentences(spans: ReadonlyArray<Span>): Array<Array<Span>> {
  const all: Array<Array<Span>> = [];
  let rest: ReadonlyArray<Span> = spans;
  for (let split = firstSentence(rest); split; split = firstSentence(rest)) {
    all.push(split[0]);
    rest = split[1];
  }
  return [...all, [...rest]];
}
