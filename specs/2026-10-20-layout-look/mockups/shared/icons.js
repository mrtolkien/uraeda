// A small stroke icon set drawn for these mockups (24px grid, 1.75 stroke). Each direction restyles it with CSS
// (stroke width, linecap) so the same glyphs read pixel-sharp, soft, or thin. Not the final set: see the options in the round.
(function () {
  const P = {
    home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
    inbox: "M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z",
    list: "M9 6h12M9 12h12M9 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01",
    plus: "M12 5v14M5 12h14",
    play: "M7 4.5v15l12-7.5z",
    pulse: "M3 12h4l3-8 4 16 3-8h4",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
    check: "M4 12.5 9.5 18 20 6.5",
    alert: "M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01",
    file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
    scale: "M12 4v16M5 20h14M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z",
    book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6",
    settings:
      "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1",
    branch:
      "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9c0 5-6 4-12 6",
    chat: "M4 5h16v11H9l-5 4z",
    search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 21 21",
    chevR: "M9 5l7 7-7 7",
    chevD: "M5 9l7 7 7-7",
    x: "M6 6l12 12M18 6 6 18",
    menu: "M4 7h16M4 12h16M4 17h16",
    spark:
      "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
    terminal: "M3 5h18v14H3zM7 10l3 2.5L7 15M12 15h5",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    layers: "M12 3 3 8l9 5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
    key: "M8 14a4.5 4.5 0 1 1 3.4-1.6L21 12v3h-3v3h-3l-3.6-3.6",
    bell: "M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4",
    folder: "M3 6h7l2 2h9v11H3z",
    bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
    leaf: "M5 19c0-9 5-14 15-15 0 10-5 15-14 15M5 19c2-4 5-7 9-9",
    tree: "M12 21v-7M12 14c-5 0-7-3-6-7 3 0 5 1 6 3 1-2 3-3 6-3 1 4-1 7-6 7zM8 21h8",
    help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01",
    bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
    diff: "M7 3v12M7 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 21V9M17 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM14 6h6",
    image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 8.5h.01",
    pencil: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3",
    drag: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
    flag: "M5 21V4M5 4h12l-2 4 2 4H5",
    flask: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7.5 15h9",
    wrench: "M14.5 6.5a4 4 0 0 0 5 5L12 19a2.8 2.8 0 0 1-4-4l7.5-7.5zM15 4a4 4 0 0 1 5 5",
    robot: "M5 8h14v11H5zM12 8V4M9 13h.01M15 13h.01M9.5 16.5h5M3 12v3M21 12v3",
    gauge: "M4 17a8 8 0 1 1 16 0M12 17l4-6M8 17h.01M16 17h.01",
    sidebar: "M3 4h18v16H3zM9 4v16",
    panelB: "M3 4h18v16H3zM3 14h18",
    msg: "M3 6h18v12H3zM3 7l9 7 9-7",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
    undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    history: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5M12 8v4l3 2",
    scroll: "M7 3h12v15a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6M7 3a3 3 0 0 0-3 3v1h3M10 8h6M10 12h6",
  };
  window.icon = function (name, size = 18, cls = "") {
    const d = P[name] || P.help;
    return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  };
  window.ICON_NAMES = Object.keys(P);

  // Harness marks: simple geometric stand-ins, NOT the official logos (see the question about brand assets).
  const H = {
    claude: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
    codex: '<path d="M12 3 20 8v8l-8 5-8-5V8zM12 3v18M4 8l16 8M20 8 4 16"/>',
    pi: '<path d="M5 6h14M9 6v13M15 6v10a3 3 0 0 0 3 3"/>',
    gemini: '<path d="M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10z"/>',
  };
  window.harness = function (name, size = 18) {
    return `<svg class="ico harness harness-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${H[name] || H.claude}</svg>`;
  };
})();
