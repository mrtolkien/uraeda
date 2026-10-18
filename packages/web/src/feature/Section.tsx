// A section of the feature page: its heading, then its content.
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

/** A section's heading, then its content; `id` is its anchor, which a figure leads to. */
export function Section({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section aria-label={title} id={id}>
      <VStack gap={3}>
        <Heading level={2}>{title}</Heading>
        {children}
      </VStack>
    </section>
  );
}
