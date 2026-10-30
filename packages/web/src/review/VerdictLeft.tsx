// A verdict whose commit failed, on its page once it reads the file as it now is: the approval, or
// the request for changes, is written, not committed, and the commit page never lists a feature's
// file, so the notice says so beside the file's status, with Try again, which commits what it left
// written (R93). A hook's refusal undoes the verdict: its page is the review's again, which shows it.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { useFile } from "../data.ts";
import { refusal } from "../errors.ts";
import { StatusText } from "../fields/StatusText.tsx";
import { FileView } from "../views.ts";
import { kindName, useFeatureTitle } from "../writes/labels.ts";
import { RefusedHere } from "../writes/RefusedHere.tsx";
import { useClearRefusal, writeHere } from "../writes/useWriteQueue.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The failed commit of the verdict on `file`, with Try again, and Try again's own refusal. */
export function VerdictLeft({ file }: { file: File }) {
  const fate = useFateClient();
  const where = { file: file.name, folder: file.folder };
  const clearRefusal = useClearRefusal(where);
  const subject = `the ${kindName(file.kind)} of ${useFeatureTitle(file.folder)}`;
  const [refused, setRefused] = useState<string>();
  const retry = async () => {
    setRefused(undefined);
    clearRefusal();
    const result = await fate.mutations.commit.retry({
      input: { ...where, write: writeHere(`Committing the review of ${subject}`) },
      view: FileView,
    });
    if (result.error) {
      setRefused(refusal(result.error).message);
    }
  };
  return (
    <>
      <RefusedHere
        onRetry={retry}
        what={`the ${kindName(file.kind)} awaits your verdict again.`}
        where={where}
      />
      {refused && <StatusText tone="error">{refused}</StatusText>}
    </>
  );
}
