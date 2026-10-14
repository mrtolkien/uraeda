import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { useRef } from "react";

/** The types the picker offers: the core takes these, and refuses any other. */
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * "Add image", or "Add images" for several, with a paperclip: opens the system's picker, on
 * phones its photos and camera, and hands the picked files over. Icon only where the space is
 * short, like the composer's bar.
 */
export function AttachButton({
  multiple = false,
  onFiles,
  isIconOnly = false,
  isDisabled = false,
}: {
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  isIconOnly?: boolean;
  isDisabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const label = multiple ? "Add images" : "Add image";
  const picker = (
    // oxlint-disable-next-line react/forbid-elements -- the system's file picker behind a button: Astryx's FileInput is a visible field (an Astryx gap, see the plan)
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      multiple={multiple}
      hidden
      aria-label={label}
      onChange={(event) => {
        const files = [...(event.currentTarget.files ?? [])];
        // The same file may be picked again.
        event.currentTarget.value = "";
        if (files.length > 0) {
          onFiles(files);
        }
      }}
    />
  );
  return (
    <>
      <Button
        label={label}
        icon={<Icon icon="uraeda:attach" />}
        isIconOnly={isIconOnly}
        isDisabled={isDisabled}
        onClick={() => input.current?.click()}
      />
      {picker}
    </>
  );
}
