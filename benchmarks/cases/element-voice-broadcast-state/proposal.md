A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title: Session information and voice broadcast state can be unreliable

## Description

Currently, outdated device information can remain after sessions are removed, and voice broadcasts
can behave unpredictably when started without a connection or when recording actions update the
broadcast state.

## Requirements

- When the list of the user's own devices has been refreshed and contains at least one device, every
  stored client information account data entry whose device id is not in that list must be deleted,
  while the entries for devices still in the list must be kept.

- While the list of the user's own devices has not been loaded yet and is empty, no client
  information account data entry must be deleted.

- While the client is in a connection error state, starting a new voice broadcast recording or
  setting up a voice broadcast pre-recording must not proceed, so no recording is started and no
  pre-recording is set up.

- When starting or setting up a voice broadcast is refused because of a connection error, an
  information dialog titled `Connection error` must be shown.

- The description of that connection error dialog must be
  `Unfortunately we're unable to start a recording right now. Please try again later.`

- The connection error dialog must offer a close button.

- When a voice broadcast recording sends its stopped, paused or resumed info state event, the last
  chunk sequence reported in that event must equal the sequence number of the most recently sent
  chunk, and must be 0 when no chunk has been sent yet.

- The change is limited to the production behavior described here; existing expectations elsewhere
  in the repository that still describe the previous behavior are replaced separately and must be
  left as they are.

- When the sessions and devices view refreshes the user's own devices, it should rely on a non-null
  current device id and obtain the user id through a safe non null path, so the refresh does not
  throw even if the user id could previously be null.

- The account data type that stores client information for a device should be formed by appending
  that device id to a single fixed client information prefix, applied consistently both when storing
  and when locating these entries.

- After the user's devices list is refreshed and contains at least one entry, any stored
  client-information account-data whose trailing device id is no longer present in the refreshed
  list should be removed, while entries for still-present devices are kept.

- Voice broadcast chunk numbering should be strictly consecutive, with the first emitted chunk
  numbered 1 and every later chunk one higher than the previous one.

- While the client is in a connection error state, starting or preparing a voice broadcast should
  not proceed, and an information dialog should be shown with title `Connection error`, description
  `Unfortunately we're unable to start a recording right now. Please try again later.`, and a close
  button.

- The stopped, paused and resumed info state events of a voice broadcast should report the number of
  the most recently sent chunk, reporting 0 while no chunk has been sent yet, so the reported value
  stays aligned with how many chunks the broadcast has emitted at that point.

- The error dialog must be opened through `Modal.createDialog` with an options object whose
  properties are exactly `title` (`Connection error`), `description` (the JSX paragraph described
  below) and a `hasCloseButton` property set to `true`; do not add a footer button in place of the
  close button.

- Pass the dialog's `description` as a JSX paragraph element, `<p>the specified text</p>`, not as a
  plain string.

## New Interfaces

- Path: `src/utils/device/clientInformation.ts`

- Name: `pruneClientInformation`

- Type: function

- Input: validDeviceIds: string[], matrixClient: MatrixClient

- Output: void

- Description: Removes client information events for devices that no longer exist. Iterates through
  the Matrix client's account data and deletes any client information entries whose device IDs are
  not in the list of valid device IDs. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
