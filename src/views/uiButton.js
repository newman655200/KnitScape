import { html } from "lit-html";

const svg = (body) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f2f2f2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  )}`;

const icons = {
  add: svg(`<path d="M12 5v14M5 12h14"/>`),
  brush: svg(`<path d="M7 17c-1.5 0-2.5 1-3 3 2-.5 3-1.5 3-3z"/><path d="M7 17 19 5l-2-2L5 15z"/>`),
  close: svg(`<path d="M6 6l12 12M18 6 6 18"/>`),
  code: svg(`<path d="m9 18-6-6 6-6"/><path d="m15 6 6 6-6 6"/>`),
  dice: svg(`<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>`),
  download: svg(`<path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>`),
  fit: svg(`<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>`),
  flip: svg(`<path d="M7 7h11l-3-3"/><path d="M17 17H6l3 3"/><path d="M12 4v16"/>`),
  fullscreen: svg(`<path d="M4 10V4h6"/><path d="M20 10V4h-6"/><path d="M4 14v6h6"/><path d="M20 14v6h-6"/>`),
  grip: svg(`<path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01"/>`),
  import: svg(`<path d="M12 21V10"/><path d="m7 15 5-5 5 5"/><path d="M5 3h14"/>`),
  library: svg(`<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3-3z"/><path d="M5 4v13"/>`),
  newFile: svg(`<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>`),
  palette: svg(`<path d="M12 4a8 8 0 0 0 0 16h1.5a1.8 1.8 0 0 0 1-3.3 1.8 1.8 0 0 1 1-3.3H17a5 5 0 0 0-5-9.4z"/><path d="M7.5 11h.01M9.5 7.5h.01M14 7.5h.01"/>`),
  pen: svg(`<path d="m4 20 4-1 10-10-3-3L5 16z"/><path d="m13 6 3 3"/>`),
  resize: svg(`<path d="M8 4H4v4"/><path d="M4 4l6 6"/><path d="M16 20h4v-4"/><path d="m14 14 6 6"/>`),
  right: svg(`<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>`),
  settings: svg(`<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>`),
  shuffle: svg(`<path d="M4 7h3c4 0 6 10 10 10h3"/><path d="M17 14l3 3-3 3"/><path d="M4 17h3c1.5 0 2.7-1.4 4-3"/><path d="M14 7c1 .8 2 1 3 1h3"/><path d="M17 5l3 3-3 3"/>`),
  undo: svg(`<path d="M9 7H4v5"/><path d="M4 12c2-4 6-6 10-5 4 1 6 4 6 8 0 2-1 4-3 5"/>`),
  up: svg(`<path d="M12 20V4"/><path d="m6 10 6-6 6 6"/>`),
  zoomIn: svg(`<circle cx="10" cy="10" r="6"/><path d="M10 7v6M7 10h6M15 15l5 5"/>`),
  zoomOut: svg(`<circle cx="10" cy="10" r="6"/><path d="M7 10h6M15 15l5 5"/>`),
};

export function buttonIcon(name, label, options = {}) {
  const img = icons[name] ?? icons.add;

  return html`<img class="button-image" src=${img} alt="" aria-hidden="true" />
    <span class="button-text">${label}</span>`;
}

export function buttonIconSrc(name) {
  return icons[name] ?? icons.add;
}
