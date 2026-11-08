// The Wiki's page: the place "Wiki", `Space w`, listing the pages of the record `pages` and drawing
// the one picked, with Astryx's components, and StyleX styles on the theme's tokens.
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { type PageApi, useRecord } from "uraeda/page";
import type { Wiki } from "./server";

const styles = stylex.create({
  body: {
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-container"],
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
  page: {
    paddingBlock: spacingVars["--spacing-3"],
  },
});

/** The wiki: a button per page, and the page picked, the first one until another is. */
function WikiPlace() {
  const wiki = useRecord<Wiki>("pages");
  const [picked, setPicked] = useState<string | null>(null);
  if (wiki.pages.length === 0) {
    const where = `${wiki.folder}/`;
    return (
      <EmptyState
        description={wiki.isMissing ? `This repository has no ${where}.` : `${where} has no page.`}
        title="No pages yet"
      />
    );
  }
  const shown = wiki.pages.find((page) => page.path === picked) ?? wiki.pages[0];
  return (
    <VStack gap={3} xstyle={styles.page}>
      <HStack gap={2} wrap="wrap">
        {wiki.pages.map((page) => (
          <Button
            key={page.path}
            label={page.title}
            onClick={() => setPicked(page.path)}
            size="sm"
            variant={page.path === shown.path ? "primary" : "secondary"}
          />
        ))}
      </HStack>
      <VStack gap={2} xstyle={styles.body}>
        <Text color="secondary" size="sm">
          {wiki.folder}/{shown.path}
        </Text>
        <Markdown>{shown.text}</Markdown>
      </VStack>
    </VStack>
  );
}

/** The page's entry: registers the place, which opens with `Space w`, and on a phone from More. */
export default function page(api: PageApi) {
  api.place({
    component: WikiPlace,
    icon: "uraeda:book-open",
    id: "wiki",
    key: "w",
    phoneTab: "more",
    title: "Wiki",
  });
}
