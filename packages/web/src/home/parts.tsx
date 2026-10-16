// The hub's parts: its rows, its stat tiles, and its cards, each with its heading.
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import type { CardVariant } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
  eyebrow: {
    textTransform: "uppercase",
  },
  // A heading's link, as tall as a control: tapped on the phone, it is one.
  headingLink: {
    alignItems: "center",
    display: "inline-flex",
    minBlockSize: "var(--size-element-md)",
  },
  // The heading's title, count, and chevron on one line, inside the heading: phrasing content only.
  heading: {
    alignItems: "center",
    columnGap: spacingVars["--spacing-2"],
    display: "inline-flex",
    flexWrap: "wrap",
  },
});

/** A row that leads somewhere, tapped as a whole. */
export function Row({
  badge,
  href,
  isSelected,
  line,
  title,
}: {
  badge?: ReactNode;
  href: string;
  isSelected?: boolean;
  line?: ReactNode;
  title: string;
}) {
  return (
    <ListItem
      description={line === undefined || line === null ? undefined : <>{line}</>}
      endContent={
        <Text aria-hidden="true" color="secondary">
          ›
        </Text>
      }
      href={href}
      isSelected={isSelected}
      // Nodes, not strings, so long titles and lines wrap instead of being cut.
      label={<>{title}</>}
      startContent={badge}
    />
  );
}

/** A stat tile: its name, its number, and a line saying what it counts; tapped, it opens `href`. */
export function Tile({
  caption,
  href,
  label,
  value,
  variant = "default",
}: {
  caption: string;
  href?: string;
  label: string;
  value: number;
  variant?: CardVariant;
}) {
  // A group named by the count, so its number and its line read with their name.
  const body = (
    <div aria-label={label} role="group">
      <VStack gap={1}>
        <Text color="secondary" type="label" xstyle={styles.eyebrow}>
          {label}
        </Text>
        <Text hasTabularNumbers size="4xl" weight="bold">
          {value}
        </Text>
        <Text color="secondary" type="supporting">
          {caption}
        </Text>
      </VStack>
    </div>
  );
  if (href) {
    return (
      <ClickableCard
        href={href}
        label={`${label}: ${value}, ${caption}`}
        padding={4}
        variant={variant}
      >
        {body}
      </ClickableCard>
    );
  }
  return (
    <Card padding={4} variant={variant}>
      {body}
    </Card>
  );
}

/**
 * A card of the hub: its heading, its count, and its rows. With `href`, its heading opens the page
 * the card sums up, tapped as a whole, `label` its accessible name. `id` is its anchor, like the
 * `#done` the sidebar's Done area opens.
 */
export function Panel({
  children,
  count,
  href,
  id,
  label,
  title,
}: {
  children: ReactNode;
  count?: number;
  href?: string;
  id?: string;
  label?: string;
  title: string;
}) {
  const wide = useWidthClass() === "wide";
  // The card is a region named by its heading.
  const headingId = useId();
  const parts = (
    <span {...stylex.props(styles.heading)}>
      {title}
      {count !== undefined && <Badge label={String(count)} variant="neutral" />}
      {href && (
        <Text aria-hidden="true" color="secondary">
          ›
        </Text>
      )}
    </span>
  );
  return (
    <section aria-labelledby={headingId} id={id}>
      <Card padding={wide ? 4 : 3}>
        <VStack gap={2}>
          <Heading id={headingId} level={2}>
            {href ? (
              <Link
                color="primary"
                href={href}
                label={label}
                type="inherit"
                xstyle={styles.headingLink}
              >
                {parts}
              </Link>
            ) : (
              parts
            )}
          </Heading>
          {children}
        </VStack>
      </Card>
    </section>
  );
}
