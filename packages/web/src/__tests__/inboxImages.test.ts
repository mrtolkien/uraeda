// A note's image removed from its draft: only the links to that image go, a line they leave empty
// with them, and the blank line the core wrote before it when nothing follows.
import { expect, test } from "vite-plus/test";
import { withoutImage } from "../inboxImages.ts";

test.each([
  {
    expected: "# Flat\n\nHeadings are flat\n",
    text: "# Flat\n\nHeadings are flat\n\n![shot](images/shot.webp)\n",
    what: "the last line, with the blank line before it",
  },
  {
    expected: "Flat\n\n![other](images/other.webp)\n",
    text: "Flat\n\n![shot](images/shot.webp)\n\n![other](images/other.webp)\n",
    what: "one of two images, the other kept",
  },
  {
    expected: "See and more\n",
    text: "See ![shot](./images/shot.webp) and more\n",
    what: "an image inside a line, the line kept",
  },
  {
    expected: "Flat\n\n![shot](images/shot.webp.old)\n",
    text: "Flat\n\n![shot](images/shot.webp.old)\n",
    what: "nothing for an image whose name only starts the same",
  },
  {
    expected: "Flat\n",
    text: 'Flat\n\n![a (1)](<images/a (1).webp> "A title")\n',
    what: "a name with spaces and brackets, in angle brackets, with a title",
  },
])("withoutImage removes $what", ({ expected, text }) => {
  const target = text.includes("a (1)") ? "images/a (1).webp" : "images/shot.webp";
  expect(withoutImage(text, target)).toBe(expected);
});
