/** The results page's style, from the mockup: light and dark, with no outside file. */
export const REPORT_STYLE = `
      :root {
        color-scheme: light dark;
        --surface: #ffffff;
        --page: #f5f6f8;
        --ink: #14171f;
        --ink-2: #4a5160;
        --ink-3: #6b7280;
        --line: #e3e6ec;
        --accent: #3b5bdb;
        --track: #e9ecf5;
        --good: #1b7f4b;
        --good-bg: #e4f5ec;
        --bad: #b4281f;
        --bad-bg: #fbe8e6;
        --warn: #8a5a00;
        --warn-bg: #fff2d6;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --surface: #1a1d26;
          --page: #11131a;
          --ink: #eef0f5;
          --ink-2: #b4bac8;
          --ink-3: #8b93a5;
          --line: #2b3040;
          --accent: #8da2ff;
          --track: #2a3045;
          --good: #5fd39a;
          --good-bg: #16352a;
          --bad: #ff8a80;
          --bad-bg: #3d1f1d;
          --warn: #f2c15c;
          --warn-bg: #3a2e12;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--page);
        color: var(--ink);
        font:
          15px/1.5 system-ui,
          sans-serif;
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 40px 24px 80px;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 28px;
        letter-spacing: -0.02em;
      }
      .lede {
        margin: 0 0 32px;
        color: var(--ink-2);
      }
      section {
        margin-bottom: 40px;
      }
      .suite-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 16px;
        margin-bottom: 8px;
      }
      h2 {
        margin: 0;
        font-size: 18px;
      }
      .meta {
        color: var(--ink-3);
        font-size: 13px;
      }
      .latest {
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--accent);
        color: var(--surface);
        font-size: 12px;
        font-weight: 600;
      }
      .card {
        overflow-x: auto;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 820px;
      }
      th {
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        color: var(--ink-3);
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      td {
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: middle;
      }
      tbody tr:last-child td {
        border-bottom: 0;
      }
      td.case {
        width: 26%;
        font-weight: 600;
      }
      td.case small {
        display: block;
        color: var(--ink-3);
        font-weight: 400;
      }
      td.num,
      th.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
      }
      .pill.pass {
        background: var(--good-bg);
        color: var(--good);
      }
      .pill.fail {
        background: var(--bad-bg);
        color: var(--bad);
      }
      .pill.flag {
        background: var(--warn-bg);
        color: var(--warn);
      }
      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 150px;
      }
      .track {
        flex: 1;
        height: 8px;
        overflow: hidden;
        border-radius: 4px;
        background: var(--track);
      }
      .fill {
        height: 100%;
        border-radius: 4px;
        background: var(--accent);
      }
      .bar span {
        min-width: 44px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .muted {
        color: var(--ink-3);
      }
      .verdict {
        font-size: 13px;
        color: var(--ink-2);
      }
      footer {
        color: var(--ink-3);
        font-size: 13px;
      }
    `;
