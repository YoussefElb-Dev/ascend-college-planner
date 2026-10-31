import { escapeHTML as h } from "./core.js";

export function progressRing(percent, label, { className = "", tone = "applications", caption = "" } = {}) {
  const numeric = Number(percent);
  const value = Number.isFinite(numeric) ? Math.round(Math.min(100, Math.max(0, numeric))) : 0;
  return `<span class="completion-ring ${h(className)}" data-progress-tone="${h(tone)}" role="progressbar" aria-label="${h(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><svg class="completion-ring-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle class="completion-ring-track" cx="50" cy="50" r="44"/><circle class="completion-ring-fill" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${value} 100" transform="rotate(-90 50 50)"${value === 0 ? ' visibility="hidden"' : ""}/></svg><span class="completion-ring-content"><strong>${value}<small>%</small></strong>${caption ? `<span class="completion-ring-caption">${h(caption)}</span>` : ""}</span></span>`;
}
