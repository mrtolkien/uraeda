// The stories and images an agent's message links, drawn by the transcript's markdown: a story link
// alone in its paragraph shows the story, and one inside a sentence opens the story page. An image
// of the repository's `specs/`, or a prototype's image linked alone, is drawn from the repository.
// Whether a link is a story link is the core's rule, asked through a `StoryHref` record for each
// link (R3): a link shows as a plain one until it is known. A message streaming shows no story: a
// paragraph that is a link alone for a moment would start a Storybook for nothing.
import { Link } from "@astryxdesign/core/Link";
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  Suspense,
  useContext,
} from "react";
import { useStoryHref } from "./data.ts";
import { ImageView } from "./ImageView.tsx";
import { ProseParagraph } from "./Prose.tsx";
import { useRepoPath } from "./routes.tsx";
import { imagePath, prototypePath } from "./Spans.tsx";
import { StoryEmbed } from "./StoryEmbed.tsx";
import { embedComment, type Stories, StoryContext, storyHref } from "./stories.tsx";

type LinkProps = { children: ReactNode; href: string };

/**
 * What an agent's message tells the stories it links: whether it ended, as a message shows its
 * stories only then, not while it streams.
 */
export type MessageStories = { ended: boolean };

export const MessageStories = createContext<MessageStories | undefined>(undefined);

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

/** A link to a story, to its checkout's story page; another link as it is. */
function StoryOrPlainLink({ children, folder, href }: LinkProps & { folder: string }) {
  const here = useRepoPath();
  const story = useStoryHref(href);
  return <PlainLink href={story ? here(storyHref(folder, story)) : href}>{children}</PlainLink>;
}

/** An agent's link: a story's, when its checkout has a preview decision, opens its story page. */
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
  if (!story) {
    return paragraph;
  }
  const label = textOf(link.children);
  return (
    <StoryEmbed
      comment={embedComment(stories, story)}
      folder={stories.folder}
      key={`${stories.folder}:${story.path}#${story.export}`}
      story={{ ...story, label }}
    />
  );
}

/**
 * The path, within its repository, an agent's link or image names, from the repository's top
 * level, as its story links are: none for the web, another scheme, or a link within the page.
 */
function repositoryPath(href: string): string | undefined {
  return /^([a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(href)
    ? undefined
    : href.replace(/^\//, "").split(/[?#]/)[0];
}

/**
 * An agent's image: a file of the repository's `specs/`, as a prototype's SVG, drawn from the
 * repository; any other as Astryx's markdown gave it.
 */
function AgentImage({ alt, src }: { alt: string; src: string }) {
  const here = useRepoPath();
  const path = imagePath(repositoryPath(src));
  return <ImageView alt={alt} src={path === undefined ? src : here(path)} />;
}

/**
 * An agent's paragraph, in prose's rhythm as any markdown's: a story link alone in it shows the
 * story, once the message ended, and a link alone to a prototype's image draws the image.
 */
function AgentParagraph({ children }: { children: ReactNode }) {
  const stories = useContext(StoryContext);
  const ended = useContext(MessageStories)?.ended ?? true;
  const here = useRepoPath();
  const alone = linkAlone(children);
  const prototype = alone && prototypePath(repositoryPath(alone.href));
  if (alone && prototype) {
    return (
      <ProseParagraph>
        <ImageView alt={textOf(alone.children)} src={here(prototype)} />
      </ProseParagraph>
    );
  }
  const link = stories?.preview && ended ? alone : undefined;
  const paragraph = <ProseParagraph>{children}</ProseParagraph>;
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
 * The components an agent's markdown draws its links, paragraphs, and images with: a story link
 * alone in its paragraph shows the story, and inside a sentence opens the story page; an image of
 * the repository draws from it.
 */
export const agentStories = { image: AgentImage, link: AgentLink, paragraph: AgentParagraph };
