---
status: answered
---

# Clarifications, round 01: Migration to Native Shell and a Rust server

> [!NOTE]
>
> Answered on 2026-11-10, in a conversation: this file records the questions asked there and the
> human's answers.
>
> - Verdict: worth building, with changes: the server is ported too, and iOS and macOS are left out.
> - Three choices last beyond the migration: a Rust server, extensions' server parts in a VM, and
>   device pairing.

## Context

### Goal

The human asked to move Uraeda's UI off React, for performance, native apps, and a look of its own.
After two spikes they chose Native Shell, and asked for a migration plan.

### Today

Uraeda has a Rust core, a Node server ([`packages/server/`](/packages/server/)), and a React web UI
([`packages/web/`](/packages/web/)).

### Scope

The migration covers the server, the Linux app, and the web build. The human said iOS and macOS are
not part of it: they come later, on a Mac.

### Sources

- The two spikes, on the branches `spike/nsh` and `spike/exact`.
- [Native Shell](https://github.com/longbridge/nsh), its documentation, and its source.
- The Node server's and the web UI's code.

## Q1: What happens to the TypeScript server in this migration?

Why it matters: it decides the size and the order of the whole migration.

- **A (recommended). Port the server to Rust in phase 0.**
  - [pro] One language below the UI, one binary, no Node.
  - [con] It roughly doubles the migration, and puts risky work first.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Keep it, and port the UI only.**
  - [pro] Agents, runs, and extensions' server parts keep working.
  - [con] Node and the binding stay.
- **C. Keep it now, and plan the Rust port as a last phase.**
  - [pro] Lower risk first.
  - [con] Two protocols to write over time.

**Answer:** Port the server to Rust in phase 0.

## Q2: How should the plan handle the active decisions the migration contradicts?

Why it matters: it decides who writes the new rules, and when work may start.

- **A (recommended). The plan drafts the revised decisions, and stops until the human approves
  them.**
  - [pro] One gate, before anything is built.
  - [con] The human reviews eleven decisions at once.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. The human rewrites the decisions first.**
  - [pro] The human's own words.
  - [con] The plan waits on that work.
- **C. Each phase revises its own decisions.**
  - [pro] Each change is reviewed beside its work.
  - [con] More gates.

**Answer:** The plan drafts them, and the human approves.

## Q3: What happens to the React web UI while the new clients are built?

Why it matters: it decides whether Uraeda stays usable, and how much double work there is.

- **A (recommended). Freeze it now, and remove it at the web phase.**
  - [pro] No double work on features.
  - [con] No new feature reaches users until the new app is ready.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Both run until parity, the React UI maintained.**
  - [pro] Users keep getting fixes.
  - [con] Every change is made twice.
- **C. Remove it as soon as the Linux app works.**
  - [pro] Less code sooner.
  - [con] No web access for a while.

**Answer:** Freeze it now.

## Q4: What does phase 0, the core, cover?

Why it matters: it decides what is built before any screen.

- **A (recommended). Everything shared by all clients: the server, the protocol, the store, the
  component library, and the extension host.**
  - [pro] Screens start on a finished base.
  - [con] A long phase before the first screen.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Only the non-visual core.**
  - [pro] A shorter first phase.
  - [con] The library is built under the pressure of screens.

**Answer:** You decide. It was a rough idea of the importance of platforms.

## Q5: What runs an extension's server part, with a Rust server?

Why it matters: it decides what extensions can still do, and how the built-in agent runtimes are
written.

- **A (recommended). TypeScript in a VM embedded in the server, with the built-in claude and codex
  runtimes in Rust.**
  - [pro] The owner's `server.ts` keeps working, and the hot path is Rust.
  - [con] Two ways to write a runtime.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Everything in the VM, built-ins included.**
  - [pro] One path.
  - [con] Agent streams parsed in an interpreter.
- **C. UI-only extensions.**
  - [pro] Simplest.
  - [con] Extensions lose their server parts.

**Answer:** TypeScript in an embedded VM, built-ins in Rust.

## Q6: How should a remote device reach the server and sign in?

Why it matters: it decides who owns network exposure, and how a native client signs in.

- **A (recommended). The owner's own tunnel, plus pairing: a one-time code gives the device a token
  the owner can revoke.**
  - [pro] Uraeda still listens on loopback only.
  - [con] The owner sets up the tunnel.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. The server listens on the network itself, with its own certificate.**
  - [pro] No tunnel to set up.
  - [con] Uraeda owns network exposure.
- **C. Leave remote access out of this plan.**
  - [pro] Less work now.
  - [con] A later proposal.

**Answer:** Your own tunnel plus device pairing.

## Q7: How does the human steer the new look?

Why it matters: it decides how much of the human's time the design takes, and how much rework it
avoids.

- **A (recommended). Two gates: the design language first, then the full gallery.**
  - [pro] Least rework.
  - [con] Two reviews.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. One gate, on the gallery.**
  - [pro] One review.
  - [con] A wrong direction is found late.
- **C. No gate.**
  - [pro] Fastest.
  - [con] Changes are asked on finished screens.

**Answer:** Two gates: language first, then gallery.

## Q8: What should modal editing be on the new clients?

Why it matters: it decides how complete Vim is, and who maintains it.

- **A (recommended). Uraeda's own Vim layer in Rust, a named subset.**
  - [pro] Works on every platform, tested key by key.
  - [con] Ex commands and macros come later.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Vim and Helix layers.**
  - [pro] Two flavours.
  - [con] Twice the behaviour to keep right.
- **C. Plain editing first, Vim later.**
  - [pro] Less work now.
  - [con] No Vim for a while.

**Answer:** Our own Vim layer in Rust, a defined subset.

## Q9: How should the Rust server ship?

Why it matters: it decides what users install.

- **A (recommended). One `ura` binary, with `ura serve`.**
  - [pro] One artifact, no Node.
  - [con] The CLI grows.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. The server inside the desktop app, plus `ura serve`.**
  - [pro] The app works alone.
  - [con] Two ways to run one server.
- **C. A separate server binary.**
  - [pro] A small CLI.
  - [con] One more artifact to release.

**Answer:** One `ura` binary with `ura serve`.

## Q10: Which Linux packages should the first release produce?

Why it matters: it decides the release's work.

- **A (recommended). A tarball and an AppImage.**
  - [pro] What the framework's packager makes directly.
  - [con] No distribution's own package.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Also an Arch package, a Flatpak, or deb and rpm.**
  - [pro] Native installs.
  - [con] More to build and test.

**Answer:** Tarball and AppImage.

## Q11: Must the Rust server keep working on the data an installation already has?

Why it matters: it decides whether history survives, and how free the new formats are.

- **A (recommended). Keep the config, themes, and repositories as they are, and import sessions once
  into a new store.**
  - [pro] History survives, and the store fits streaming.
  - [con] An import step.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. Read every existing file in place.**
  - [pro] No import.
  - [con] Two servers on one session store.
- **C. Start fresh.**
  - [pro] Simplest.
  - [con] History is lost.

**Answer:** Do what's best. The existing formats exist for a reason, but you're allowed to make
something better.

## Q12: How should the plan stand, with no spec to argue from?

Why it matters: it decides what the human reviews before the plan.

- **A (recommended). Write a short spec too, from this conversation.**
  - [pro] Follows the workflow.
  - [con] One more document.
  - Why recommended: it fits what the spikes measured and what the human had said.
- **B. The master plan carries the approach alone.**
  - [pro] One document.
  - [con] No spec for the plan to argue from.

**Answer:** Write a short spec.md too.

**Notes:**

- The human added, while the plan was written: "iOS and MacOS are _not_ part of this plan. The plan
  stops after the web app being ready."
- On iOS, later: "we should use native widgets, which are glassy".
