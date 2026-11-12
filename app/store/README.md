# The client store

Every screen reads the server through `app/store`, and only through it: records as signals, actions
as promises, and the device's own choices. The server owns every fact; the store holds a cache of
what is read now, kept live over one WebSocket. Import from `app/store` (`index.ts`), never from its
files.

## A record

`record(name, args)` reads a record of the protocol (`protocol.d.ts`, `Records`), typed by its name.
It is subscribed while the component, effect, or computation that called it is there, and 5 s after
(`GRACE`): a pane that hides and shows again does not ask twice.

```tsx
function Title(props: { repo: string; id: string }) {
  const feature = record("Feature", { id: props.id, repo: props.repo });
  const failed = () => feature.error();
  return (
    <If
      when={failed()}
      else={
        <If when={feature() !== undefined} else={<Spinner label="Reading the feature" />}>
          <If
            when={feature()}
            else={<Empty title="No such feature" words="It was dropped or merged." />}
          >
            {(shown) => <Heading>{shown().label ?? props.id}</Heading>}
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner tone="danger" title="The feature could not be read">
          {error().message}
        </Banner>
      )}
    </If>
  );
}
```

- `feature()` is `undefined` until the value came, then the value, which may be `null` when the
  record says there is none. `feature.error()` says why the server would not give it.
- A change redraws what read the part it changed, and nothing else. A value is never changed in
  place: what did not change keeps its object, so compare by `===`.

## An action, and its refusal

`call(name, input)` runs an action (`Actions`) and gives its output. It rejects with a `StoreError`,
`code` and `message`: the server's codes (`refused`, `conflict`, `hook`, ...), or `offline`, at
once, when there is no line, or `dropped` when the line dropped before the answer, and the action
may have run. A control shows the refusal under itself, with `sent`:

```tsx
const vim = sent(
  () => record("Settings", null)()?.keyboard.vimMode.inForce ?? false,
  (on) => call("settings.setVimMode", { on }),
);
<Switch
  label="Vim"
  value={vim.value()}
  onChange={vim.set}
  pending={vim.pending()}
  refusal={vim.refusal()}
/>;
```

## A list

`list(source, "rows")` reads a list of a record: `rows()`, the rows in order, and `item(id)`, one
item from a signal of its own. The rows' array is new only when an item comes, goes, or moves, and
keeps every row's object as it was, so the list keeps their cells; an item's change redraws its row
alone. A `VirtualList` reuses a row's cell for another row: read `id()` where it is used.

```tsx
const sessions = record("SessionList", { repo });
const shown = list(sessions, "rows");
const cursor = createCursor(shown.rows);
<VirtualList cursor={cursor} row={(id) => <Line label={shown.item(id())?.title ?? ""} />} />;
```

## A growing text

`text(source, path)` reads a text of a record, `["items", id, "text"]` for a reply: it grows by each
`append`, and is set whole when the record is read again. Give it to `Reply` with the item's state,
`streaming`, which ends it:

```tsx
const page = record("TurnLog", { page, repo, turn });
const log = list(page, "items");
<Reply text={text(page, ["items", id, "text"])} done={() => log.item(id)?.streaming === false} />;
```

## A transcript of 20,000 messages

A session is `Session` (its turns' ids), each turn a `Turn` (its `pages`), and each page a
`TurnLog { repo, turn, page }` of 100 items. The session's pane reads:

- **A window of pages**, in one effect that runs again as the list scrolls: the last turn's pages,
  which grow, and the pages of the turns within two screens of the rows shown (`onOffset`). The
  effect lets the pages behind go and reads the new ones; the grace keeps those that stayed. A fast
  fling far up reads only where it stops.
- **One row array** for the list: a page's items, as `${turn}/${id}`, since an item's id is its
  place in its turn; and one row for each turn not read yet, which says it and becomes the turn's
  items once read. Keep each row's object in a map by that id, so the joined array keeps them: it
  changes when a page's rows change, an item coming, never for a piece of a reply.
- **A row** reads its item from its own page, `list(page, "items").item(id)`, and its reply with
  `text`, as above. The reply that grows is the last row, which the list follows (`follow`).

## A time

`serverTime(at)` writes an instant of a record, an RFC 3339 text or milliseconds, in the server's
time zone, as near to now as it is: "15:08", "Tue 15:08", "12 Nov 15:08", "12 Nov 2025".
`serverClock(at)` gives its year, month, day, hour, minute, and day of the week. The shell reads the
server's zone from the repository shown; until it has, times read in the device's own. `Date`'s
`getHours` and its kin read the device's zone: never show them.

## What the device keeps

`device.get(key)` and `device.set(key, value)` read and keep a choice of this device, a theme, a
width, a text not saved yet, by the names of `DeviceKeys` (`device.ts`). A value is read back at
once, from memory, and written after.

- A key's writes go one at a time, each with the value the key holds as it starts: the storage ends
  on the last value set, however its answers come.
- `set(key, value, { rest })` waits for a pause, for a value that changes at every key typed;
  `flush()` writes what waits, as the app leaves the front.
- A family of values, one per field or per file, is a pattern of keys, found with
  `device.keys(prefix)`. Never keep a list of them beside them: two writes of the list cross, and a
  value is there that the list does not name.
- A field's text is never kept by hand: it is `unsavedText` (`app/ui/text`), whose `save` and `send`
  are the only ways it reaches the server.

## Never

- **Keep a record's value in a component's state, or copy it into a signal.** Read it where it is
  drawn: a copy does not change with the server, and is stale after a reconnect.
- **Call `record` in a listener or at a module's top level.** Nothing would let it go: it stays
  subscribed. In a listener, read the record the component already holds.
- **Read `rows()` for what a row shows.** A row is an id; its item is `item(id)`, whose changes
  redraw that row only.
- **Open a socket, or `fetch` the server's routes for data.** `/live` is the store's; HTTP is for
  bytes, images, and uploads, with the address and token the shell gives.

## The connection

The shell (task 36) makes it once: `connect({ address, signIn })`, the server's address and how the
device signs in (`{ by: "token", token }` for a paired device, `{ by: "cookie" }` in a browser).

- `status()`: `connecting`, `live`, `offline` (between tries, after 0.5 s, then 1, 2, 4, 8, and 10
  s), or `refused`, for good. `reconnect()` tries at once.
- `stale()`: the records were live and the line is not: the shell's banner, "the server stopped".
  Records keep their last values; calls fail at once.
- `refused()`: why, with `update`, `"app"`, `"server"`, or `"sign-in"` for a token the server no
  longer knows, as a revoked device's: the shell shows the pairing screen, then connects again.
- `extensionHost()` is what an extension's page gets (`app/extensions/host.tsx`).
