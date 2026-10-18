// The spec page of the specs redesign (`specs/done/2026-10-17-redesign-specs.md`), as the app draws it,
// over the spec page's feature that `addSpecFeature` builds from `fixtures/spec-page/` (see
// `.storybook/fixture.ts`): its data comes from Uraeda's server in Storybook, through fate.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SPEC_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";

const meta = {
  args: { folder: SPEC_PAGES.waiting, name: "spec.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Spec page",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * A spec at its second revision, waiting for review. On a wide screen, each part is a card: what
 * you approve, your review answered, each decision with its change, each story with its key
 * scenarios as Given, When, and Then rows, the data model, then how it is built. "Contents" and the
 * verdict sit in the right column. On the phone, the parts take the screen's width, without cards,
 * each title sticking at the top under its breadcrumbs.
 */
export const Waiting: Story = {};

/** The same spec approved: read-only, its approval record first, no verdict. */
export const Approved: Story = { args: { folder: SPEC_PAGES.approved } };
