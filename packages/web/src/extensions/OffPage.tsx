// The page of a built-in place turned off here, which a link still leads to: "Inbox is off here",
// with a button that turns it on in this repository, as Settings, Extensions would.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { useRepository } from "../routes.tsx";
import { withOn } from "../settings/extensions.ts";
import { useExtensionsRecord } from "../settings/useExtensionsRecord.ts";
import { ExtensionsRecordView } from "../settings/settingsViews.ts";

/** The page of the built-in `name`, off in this repository. */
export function OffPage({ name }: { name: string }) {
  const fate = useFateClient();
  const repository = useRepository();
  const record = useExtensionsRecord();
  const row = record?.extensions.find((one) => one.name === name);
  const [error, setError] = useState<string>();
  const [isTurning, setTurning] = useState(false);
  const turnOn = async () => {
    setTurning(true);
    try {
      const on = [...(row?.on ?? []), repository];
      // Drawn at once, as the settings page draws a switch: the page comes back with the record.
      const { error } = await fate.mutations.extensions.setOn({
        input: { name, on },
        ...(record && {
          optimistic: { extensions: withOn(record.extensions, name, on), id: record.id },
        }),
        view: ExtensionsRecordView,
      });
      if (error) {
        setError(refusal(error).message);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setTurning(false);
    }
  };
  return (
    <VStack gap={2}>
      <Banner
        collapsible={false}
        endContent={
          <Button isLoading={isTurning} label="Turn it on here" onClick={() => void turnOn()} />
        }
        status="info"
        title={`${row?.title ?? name} is off here`}
      />
      {error && <AnnouncedBanner collapsible={false} status="error" title={error} />}
    </VStack>
  );
}
