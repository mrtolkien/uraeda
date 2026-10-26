// Rename, from a session's "…" in the shell or on its page: a dialog on wide screens, a bottom sheet on the phone,
// drawn beside the shell, as a feature's settings are. The server refuses a blank title.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { Overlay } from "../layout/Overlay.tsx";
import { SessionView } from "../views.ts";
import type { Row } from "./cards.ts";
import { StatusText } from "../fields/StatusText.tsx";

/** The session renamed: its ID and its title. */
type Renamed = Pick<Row, "id" | "title">;

/** Opens a session's Rename, then calls `onClosed` once it closes. */
type Open = (row: Renamed, onClosed?: () => void) => void;

const OpenContext = createContext<Open>(() => {});

/** Opens a session's Rename. */
export function useOpenRename(): Open {
  return useContext(OpenContext);
}

function Rename({ onClose, row }: { onClose: () => void; row: Renamed }) {
  const fate = useFateClient();
  const [title, setTitle] = useState(row.title);
  const [error, setError] = useState<string>();
  const changed = title.trim() !== row.title;
  const save = async () => {
    setError(undefined);
    const result = await fate.mutations.session.rename({
      input: { session: row.id, title: title.trim() },
      view: SessionView,
    });
    if (result.error) {
      setError(refusal(result.error).message);
      return;
    }
    onClose();
  };
  return (
    <VStack gap={4}>
      <TextInput
        hasAutoFocus
        label="Title"
        onChange={setTitle}
        onEnter={() => {
          if (changed) {
            void save();
          }
        }}
        value={title}
      />
      {error && (
        <StatusText role="alert" tone="error" type="supporting">
          {error}
        </StatusText>
      )}
      <HStack align="center" gap={2} justify="end">
        <Button label="Cancel" onClick={onClose} />
        <Button clickAction={save} isDisabled={!changed} label="Save" variant="primary" />
      </HStack>
    </VStack>
  );
}

/** The Rename dialog, drawn beside `children`, the shell, for the session opened. */
export function RenameSessionHost({ children }: { children: ReactNode }) {
  const [row, setRow] = useState<Renamed>();
  // Drawn from its first opening on, as a feature's settings are.
  const [drawn, setDrawn] = useState(false);
  // Called once the dialog closed, when the page outside it takes the focus again.
  const closed = useRef<() => void>(undefined);
  useEffect(() => {
    if (row === undefined) {
      closed.current?.();
      closed.current = undefined;
    }
  }, [row]);
  const close = () => setRow(undefined);
  const open: Open = (opened, onClosed) => {
    closed.current = onClosed;
    setDrawn(true);
    setRow(opened);
  };
  return (
    <OpenContext value={open}>
      {children}
      {drawn && (
        <Overlay
          isOpen={row !== undefined}
          label="Rename the session"
          onClose={close}
          sheetHeight="hug"
        >
          {row && <Rename key={row.id} onClose={close} row={row} />}
        </Overlay>
      )}
    </OpenContext>
  );
}
