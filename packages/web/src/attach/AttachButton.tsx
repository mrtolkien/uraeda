import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { useRef } from "react";

/** The types the picker offers: the core takes these, and refuses any other. */
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * "Add image", or "Add images" for several, with a paperclip: opens the system's picker, on
 * phones its photos and camera, and hands the picked files over. Icon only where the space is
 * short, like the composer's bar. `name` tells the button apart where a page has several, as
 * "Add image to the notes": it starts with what the button shows, which stays "Add image".
 */
export function AttachButton({
  isDisabled = false,
  isIconOnly = false,
  multiple = false,
  name,
  onFiles,
}: {
  isDisabled?: boolean;
  isIconOnly?: boolean;
  multiple?: boolean;
  name?: string;
  onFiles: (files: Array<File>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const shown = multiple ? "Add images" : "Add image";
  const label = name ?? shown;
  const picker = (
    // oxlint-disable-next-line react/forbid-elements -- the system's file picker behind a button: Astryx's FileInput is a visible field (an Astryx gap, see the plan)
    <input
      accept={ACCEPT}
      aria-label={label}
      hidden
      multiple={multiple}
      onChange={(event) => {
        const files = [...(event.currentTarget.files ?? [])];
        // The same file may be picked again.
        event.currentTarget.value = "";
        if (files.length > 0) {
          onFiles(files);
        }
      }}
      ref={input}
      type="file"
    />
  );
  return (
    <>
      {/* A label other than the text shown is the button's accessible name, its `aria-label`. */}
      <Button
        icon={<Icon icon="uraeda:attach" />}
        isDisabled={isDisabled}
        isIconOnly={isIconOnly}
        label={label}
        onClick={() => input.current?.click()}
      >
        {isIconOnly ? undefined : shown}
      </Button>
      {picker}
    </>
  );
}
