import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import type { MockupLink } from "uraeda-binding";
import { navigate } from "./routes.tsx";

/**
 * The spec's mockups, at the top of its review: the easiest part of a spec to check, one large
 * button per mockup its Mockups section links, each opening the mockup's page. Nothing without
 * mockups.
 */
export function ReviewMockups({
  folder,
  mockups,
  wide,
}: {
  folder: string;
  mockups: ReadonlyArray<MockupLink> | undefined;
  wide: boolean;
}) {
  if (!mockups?.length) {
    return undefined;
  }
  return (
    <HStack aria-label="Mockups" as="section" gap={2} wrap="wrap">
      {mockups.map((mockup) => (
        <Button
          key={`${mockup.path}-${mockup.block}`}
          label={`Open the mockup: ${mockup.label}`}
          onClick={() => navigate(`/f/${folder}/${mockup.path}`)}
          size="lg"
          variant="primary"
          width={wide ? undefined : "100%"}
        />
      ))}
    </HStack>
  );
}
