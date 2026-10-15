// The stories an agent's message links, drawn by the transcript's markdown: a story link alone in
// its paragraph shows the story, and one inside a sentence opens Uraeda's Storybook page. Whether a
// link is a story link is the core's rule, asked through a `StoryHref` record for each link (R3): a
// link shows as a plain one until it is known.
import { Link } from "@astryxdesign/core/Link";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  Suspense,
  useContext,
  useLayoutEffect,
} from "react";
import { useStoryHref } from "./data.ts";
import { useRepoPath } from "./routes.tsx";
import { StoryEmbed } from "./StoryEmbed.tsx";
import { embedComment, type Stories, StoryContext, storybookHref } from "./stories.tsx";

const styles = stylex.create({
  paragraph: {
    // As Astryx's compact paragraphs: a little room between them, none at the message's edges.
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-1"] },
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-1"] },
  },
});

type LinkProps = { children: ReactNode; href: string };

/** Tells the message a story shows in it, so its bubble takes the column's width. */
export const StoryShown = createContext<(() => void) | undefined>(undefined);

/** A link as Astryx's markdown draws one: the web in a new tab. */
function PlainLink({ children, href }: LinkProps) {
  return href.startsWith("https://") || href.startsWith("http://") ? (
    <Link hasUnderline href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </Link>
  ) : (
    <Link hasUnderline href={href}>
      {children}
    </Link>
  );
}

/** A link to a story, to its checkout's Storybook page; another link as it is. */
function StoryOrPlainLink({ children, folder, href }: LinkProps & { folder: string }) {
  const here = useRepoPath();
  const story = useStoryHref(href);
  return <PlainLink href={story ? here(storybookHref(folder, story)) : href}>{children}</PlainLink>;
}

/** An agent's link: a story's, when its checkout has a preview decision, opens its Storybook page. */
function AgentLink({ children, href }: LinkProps) {
  const stories = useContext(StoryContext);
  if (!stories?.preview) {
    return <PlainLink href={href}>{children}</PlainLink>;
  }
  return (
    <Suspense fallback={<PlainLink href={href}>{children}</PlainLink>}>
      <StoryOrPlainLink folder={stories.folder} href={href}>
        {children}
      </StoryOrPlainLink>
    </Suspense>
  );
}

/** The text a link shows, without its marks. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return Children.toArray(node).map(textOf).join("");
}

/** The link a paragraph holds alone, whitespace aside, if any. */
function linkAlone(children: ReactNode): LinkProps | undefined {
  const nodes = Children.toArray(children).filter(
    (node) => !(typeof node === "string" && node.trim() === ""),
  );
  const [only] = nodes;
  if (nodes.length !== 1 || !isValidElement<LinkProps>(only) || only.type !== AgentLink) {
    return undefined;
  }
  return only.props;
}

/** A paragraph holding a link alone: its story, when the link is a story's, else the paragraph. */
function StoryParagraph({
  link,
  paragraph,
  stories,
}: {
  link: LinkProps;
  paragraph: ReactNode;
  stories: Stories;
}) {
  const story = useStoryHref(link.href);
  const shown = useContext(StoryShown);
  useLayoutEffect(() => {
    if (story) {
      shown?.();
    }
  }, [shown, story]);
  if (!story) {
    return paragraph;
  }
  const label = textOf(link.children);
  return (
    <StoryEmbed
      comment={embedComment(stories, story)}
      folder={stories.folder}
      story={{ ...story, label }}
    />
  );
}

/** An agent's paragraph: a story link alone in it shows the story. */
function AgentParagraph({ children }: { children: ReactNode }) {
  const stories = useContext(StoryContext);
  const link = stories?.preview ? linkAlone(children) : undefined;
  const paragraph = (
    <div role="paragraph" {...stylex.props(styles.paragraph)}>
      {children}
    </div>
  );
  if (!stories || !link) {
    return paragraph;
  }
  return (
    <Suspense fallback={paragraph}>
      <StoryParagraph link={link} paragraph={paragraph} stories={stories} />
    </Suspense>
  );
}

/**
 * The components an agent's markdown draws its links and paragraphs with: a story link alone in its
 * paragraph shows the story, and inside a sentence opens Uraeda's Storybook page.
 */
export const agentStories = { link: AgentLink, paragraph: AgentParagraph };
