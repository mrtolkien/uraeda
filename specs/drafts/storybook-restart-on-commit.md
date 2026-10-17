# Restart a Storybook when its checkout's commit changes

An embedded story's Storybook is never restarted when its checkout's commit changes. After a commit
that changes `.storybook/`, the dependencies, or the server code, the embeds show stale or blank
stories: the round mockups of `2026-10-17-redesign-clarifications` rendered blank, since their
Storybook had started before the commit that added their fixture.

Expected: once the checkout's commit (HEAD) moved since its Storybook started, the next view
restarts it, as "Try again" does.
