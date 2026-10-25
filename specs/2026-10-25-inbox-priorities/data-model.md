# Data model: Inbox and priorities in the terminal look

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## PRIORITIES.md

The file keeps its sections. A section's context is a callout under its heading, and Blocked is
retired.

| Field                           | Type                | Meaning                                                                                  | Change  |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ------- |
| `## Now`, `## Next`, `## Later` | heading             | A section, in this order: the columns of the priorities page                             |         |
| Section context                 | `> [!NOTE]` callout | The first callout after a heading, before its first entry: what the section means now    | New     |
| `## Blocked`                    | heading             | Retired: the template, the skill, and `ura check` no longer have it                      | Removed |
| Lines under `## Blocked`        | entries             | Still read and shown while they exist, and `ura check` warns that the section is retired | Changed |

The context is the callout's text, as the reader sees it. Only the first callout of a section
counts. A callout whose marker line stands alone, with its text in a separate quote, has no text:
`ura check` warns about it. Ongoing is not in the file: it lists the running entries, and its
context is written by the app.

## INBOX.md

The file's format does not change. What changes is what the page does with it.

| Field               | Type    | Meaning                                                                                   | Change  |
| ------------------- | ------- | ----------------------------------------------------------------------------------------- | ------- |
| `## <name>` heading | heading | A category. It may hold no note, and the page now shows it                                | Changed |
| Creating a category | edit    | Adds `## <name>` at the end of the file, after the last category                          | New     |
| Renaming a category | edit    | Replaces the heading's text: its notes stay where they are                                | New     |
| Deleting a category | edit    | Removes the heading, and moves its notes to the notes without a category, or removes them | New     |
