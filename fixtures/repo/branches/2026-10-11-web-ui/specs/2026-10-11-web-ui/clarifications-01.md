---
status: awaiting-human
---

# Clarifications, round 01: Web UI for the workflow files

> [!IMPORTANT]
>
> 11 questions on the web UI, about 35 minutes.
>
> - Verdict: worth building as proposed.
> - Two choices last beyond this feature.

## Context

### Goal

The [proposal](proposal.md) asks for a web UI, reached from a phone.

### Today

Every human step happens in a text editor.

### Scope

The human steps, and how the phone reaches the server.

### Sources

- The proposal, and the stack decision.

## Q1: Which human steps does the UI perform?

Today, every human step happens in a text editor.

Why it matters: it sets the size of the feature.

- **A (recommended). Every human step: answering, reviewing specs, plans, and assessments, drafting,
  editing proposals, and starting features.**
  - [pro] the phone does everything.
  - [con] the largest feature.
  - Why recommended: the proposal asks for it.
- **B. Answering and reviewing only.**
  - [pro] smaller.
  - [con] drafting stays on the computer.
- **C. Reading only.**
  - [pro] the smallest.
  - [con] nothing is done from the phone.

**Answer:**

### Q1.B: What does reviewing cover?

Only if you picked B in Q1.

- **A (recommended). Specs, plans, and assessments.**
  - [pro] every review.
- **B. Specs only.**
  - [con] plans wait for the computer.

**Answer:**

## Q2: How does your iPhone reach the server?

The proposal says no security is needed, since you access it through Tailscale only. The active
stack decision requires the server to listen on 127.0.0.1, and to reject
any `Host` but `127.0.0.1` or `localhost`, and foreign origins, because the server will commit and
start agents, and a web page you open could otherwise reach it. `tailscale serve` keeps the server
on 127.0.0.1, but passes your machine's `*.ts.net` name, which both Vite and the server's guard
reject today. Tailscale keeps other machines out, not a malicious page opened on your Mac or phone.
More in [discovery](discovery-01.md).

Why it matters: it amends an active decision, which every later server feature follows.

- **A (recommended). Run `tailscale serve` to the server on 127.0.0.1; the server and Vite also
  accept the `*.ts.net` host and its `https://` origin given in an option. The stack decision's Host
  rule gains that case.**
  - [pro] one command on your machine, HTTPS, and a page you browse still cannot reach the server.
  - [con] the decision changes, and the host name is set once in an option.
  - Why recommended: it gives the proposal its access, and keeps what the rule protects.
- **B. A, and requests that come through Tailscale must also carry its `Tailscale-User-Login`
  header, which `tailscale serve` adds and strips from incoming requests.**
  - [pro] only people logged into your tailnet get in, at no cost.
  - [con] a second check, which the proposal does not ask for.
- **C. Listen on every interface, without the guard, as the proposal says.**
  - [pro] nothing to set up.
  - [con] the stack decision's rule is removed, your local network reaches the server too, and any
    page you browse can.

**Answer:**

## Q3: Which repositories does the UI open now?

- **A (recommended). The one it runs in.**
  - [pro] nothing to set.
- **B. Any repository, picked in the UI.**
  - [con] a picker to build.

**Answer:**

## Settled without the human

### Under the hood

- **The actions' commits move into the core**: answering and reviewing commit in the core, shared
  by `ura` and the server, with the same messages.
- **An answer is written** as the letters you pick, in order, then ": " and your comment; a comment
  alone is your own words.

**Notes:**
