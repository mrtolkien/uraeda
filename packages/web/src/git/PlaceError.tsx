// A write of the Git page refused before it reached the write queue, as by the guard of an agent at
// work, next to the section it concerns, until the place's next write. A refusal the queue's record
// holds shows through `RefusedHere` instead, with its output.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { useRefusal } from "../writes/useWriteQueue.ts";

export function PlaceError({ href, message }: { href: string; message: string | undefined }) {
  const recorded = useRefusal({ href }) !== undefined;
  return message === undefined || recorded ? null : (
    <AnnouncedBanner collapsible={false} status="error" title={message} />
  );
}
