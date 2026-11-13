// The web frame, the one view that shows a web page: a page at its room's width; a desktop's page,
// 1440 px wide, scaled to fit a narrow room and centred, as a story shows; and a page that does not
// load, which says so with the way out.
import { Page, Part } from "../parts";
import { WebFrame } from "../../ui/surfaces";

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  body { margin: 0; padding: 24px; font: 16px system-ui, sans-serif; }
  nav { display: flex; gap: 16px; padding: 12px; background: #e8e6f0; border-radius: 8px; }
  @media (prefers-color-scheme: dark) { body { background: #1e1e2e; color: #cdd6f4; } nav { background: #313244; } }
</style></head>
<body><nav><b>Tasks</b><span>Today</span><span>Upcoming</span></nav>
<h1>Repeat every week</h1><p>A task that comes back, on the days it names.</p></body></html>`;

export function web(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="At its room's width" wide>
        <WebFrame height={260} html={PAGE} title="A mockup" />
      </Part>
      <Part narrow={narrow} title="A desktop's page, scaled to fit">
        <WebFrame height={260} html={PAGE} title="A story" width={1440} />
      </Part>
      <Part narrow={narrow} title="A page that does not load">
        <WebFrame height={200} src="http://127.0.0.1:9/" title="The story Dragging" />
      </Part>
    </Page>
  );
}
