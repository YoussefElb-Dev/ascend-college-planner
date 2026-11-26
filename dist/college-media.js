import { escapeHTML as h, money, safeUrl } from "./core.js";
const CACHE = "ascend.public-college-media.v1",
  THIRTY_DAYS = 30 * 86400000;
let cache = {},
  seed = {},
  ready = false,
  observer,
  active = 0;
const queue = [],
  pending = new Set(),
  failed = new Set();
try {
  cache = JSON.parse(localStorage.getItem(CACHE) || "{}");
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) cache = {};
} catch {
  cache = {};
}
const titles = {
  170976: "University of Michigan",
  104151: "Arizona State University",
  110662: "University of California, Los Angeles",
  139755: "Georgia Institute of Technology",
  236948: "University of Washington",
  243780: "Purdue University",
};
export const featuredCollegeIds = [
  "166683",
  "186131",
  "243744",
  "131520",
  "170976",
  "104151",
  "110662",
  "164465",
  "139755",
  "236948",
  "199120",
  "243780",
];
const colleges = new Map();
const strip = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
const external = (label, url) =>
  safeUrl(url)
    ? `<a href="${h(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${h(label)}</a>`
    : "";
function checkedPhoto(p) {
  try {
    return p &&
      ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(
        new URL(p.url).hostname,
      ) &&
      new URL(p.page).hostname === "commons.wikimedia.org"
      ? p
      : null;
  } catch {
    return null;
  }
}
function known(c) {
  const v = cache[c.id] || seed[c.id];
  if (!v || typeof v.description !== "string") return null;
  return { ...v, photo: checkedPhoto(v.photo) };
}
export function collegeSummary(c) {
  return `${c.name} is a ${String(c.type || "postsecondary").toLowerCase()} institution in ${[c.city, c.state].filter(Boolean).join(", ")}${c.campusSetting ? `, in a ${c.campusSetting.toLowerCase()} setting` : ""}.${c.level ? " It offers " + c.level.toLowerCase() + " study." : ""}${c.enrollment != null ? " It reported " + Number(c.enrollment).toLocaleString() + " undergraduates in fall 2024." : ""}`;
}
function credit(v) {
  const p = checkedPhoto(v?.photo);
  const artist = p?.artist?.replace(/\s*\([^)]*\)\s*$/, "").trim().slice(0, 70) || p?.artist?.slice(0, 70) || "Wikimedia Commons";
  return p
    ? `${external("Photo: " + artist, p.page)} · ${external(p.license, p.licenseUrl)}`
    : "Campus photo unavailable";
}
function imageHTML(c, v, hero = false) {
  const p = checkedPhoto(v?.photo);
  return p
    ? `<img src="${h(p.url)}" alt="${h(p.caption || c.name + " campus")}" loading="${hero ? "eager" : "lazy"}" referrerpolicy="no-referrer" data-campus-image><div class="campus-image-fallback" hidden>Campus photo unavailable</div><span class="campus-photo-credit">${credit(v)}</span>`
    : `<div class="campus-placeholder"><span>${h(c.city || c.state || "COLLEGE PROFILE")}</span><small data-photo-status>Campus photo ${ready ? "unavailable" : "loading…"}</small></div>`;
}
export function collegeCardMedia(c) {
  colleges.set(c.id, c);
  const v = known(c);
  const id = h(c.id);
  return `<div class="campus-photo" data-college-media="${id}">${imageHTML(c, v)}</div><p class="college-description" data-college-description="${id}">${h(v?.description || collegeSummary(c))}</p><div class="college-description-credit" data-college-credit="${id}">${v?.article ? `${external("Wikipedia", v.article)} · ${external("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")}` : "NCES/IPEDS"}</div><div class="college-mini-facts"><div><small>Tuition & fees · 2025–26</small><strong>${money(c.tuitionOut ?? c.tuitionIn)}</strong></div><div><small>Undergraduates · 2024</small><strong>${c.enrollment != null ? Number(c.enrollment).toLocaleString() : "Not available"}</strong></div></div>`;
}
export function collegeHero(c) {
  colleges.set(c.id, c);
  return `<div class="campus-photo campus-hero" data-college-media="${h(c.id)}" data-hero="true">${imageHTML(c, known(c), true)}</div>`;
}
export function collegeAbout(c) {
  const v = known(c);
  const id = h(c.id);
  return `<div class="college-about" data-college-description="${id}">${h(v?.description || collegeSummary(c))}</div><div class="college-description-credit" data-college-credit="${id}">${v?.article ? `${external("Description: Wikipedia", v.article)} · ${external("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")}` : "Description based on the bundled NCES/IPEDS directory."}</div>`;
}
export function collegeCredits(c) {
  const v = known(c);
  return `<div data-college-full-credit="${h(c.id)}">${credit(v)}${v?.article ? `<p>${external("Read the source article on Wikipedia", v.article)} · CC BY-SA 4.0. Descriptions may be shortened for display.</p>` : ""}</div>`;
}
async function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`);
  u.search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    ...params,
  });
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(u, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!r.ok) throw Error("Public source unavailable");
    const d = await r.json();
    return Object.values(d.query?.pages || {})[0];
  } finally {
    clearTimeout(timer);
  }
}
async function enrich(c) {
  const title =
    titles[c.id] || c.name.replace(/-Main Campus$/, "").replace(/-/g, " ");
  const page = await api("en.wikipedia.org", {
    titles: title,
    redirects: "1",
    prop: "extracts|info|images|extlinks",
    exintro: "1",
    explaintext: "1",
    imlimit: "100",
    ellimit: "500",
    inprop: "url",
  });
  if (!page?.extract || page.missing !== undefined)
    throw Error("No verified article");
  // Exact school titles still need the school's official domain in the article.
  let domain = "";
  try {
    domain = new URL(safeUrl(c.url)).hostname.replace(/^www\./, "");
  } catch {}
  const verified =
    domain &&
    (page.extlinks || []).some((l) => {
      try {
        const host = new URL(l["*"]).hostname;
        return (
          host === domain ||
          host.endsWith("." + domain) ||
          domain.endsWith("." + host)
        );
      } catch {
        return false;
      }
    });
  if (!verified) throw Error("No official-domain match");
  const candidates = (page.images || [])
    .filter(
      (i) =>
        /\.(jpe?g|png)$/i.test(i.title) &&
        !/(seal|logo|flag|map|portrait|icon|signature|wordmark|athletics|commons|symbol|coat.of.arms|sport|football|basketball|medal|plaque)/i.test(
          i.title,
        ),
    )
    .sort(
      (a, b) =>
        (/campus|aerial|quad|main.building/i.test(b.title) ? 1 : 0) -
        (/campus|aerial|quad|main.building/i.test(a.title) ? 1 : 0),
    );
  let photo = null;
  for (const i of candidates.slice(0, 2)) {
    const info = await api("commons.wikimedia.org", {
      titles: i.title,
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "960",
    });
    const m = info?.imageinfo?.[0],
      e = m?.extmetadata || {};
    if (
      m?.width >= 600 &&
      m.width / m.height >= 1.15 &&
      /(CC BY|CC0|Public domain)/i.test(e.LicenseShortName?.value || "")
    ) {
      photo = {
        url: m.thumburl || m.url,
        page: m.descriptionurl,
        artist: strip(e.Artist?.value).slice(0, 300),
        license: strip(e.LicenseShortName?.value),
        licenseUrl:
          e.LicenseUrl?.value ||
          "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia",
        caption:
          strip(e.ImageDescription?.value).slice(0, 500) ||
          i.title.replace("File:", ""),
      };
      break;
    }
  }
  return {
    description: page.extract.slice(0, 8000),
    article: page.fullurl,
    title: page.title,
    photo,
    fetched: Date.now(),
  };
}
function bindMediaImage(el) {
  const img = el.querySelector("img");
  if (!img || img.dataset.boundError) return;
  img.dataset.boundError = "1";
  const showFallback = () => {
    img.hidden = true;
    const fb = el.querySelector(".campus-image-fallback");
    if (fb) fb.hidden = false;
    const cr = el.querySelector(".campus-photo-credit");
    if (cr) cr.hidden = true;
  };
  if (img.complete && img.naturalWidth === 0) {
    showFallback();
  } else {
    img.addEventListener("error", showFallback, { once: true });
  }
}
function patch(c) {
  const v = known(c);
  const selId = CSS.escape(c.id);
  document.querySelectorAll(`[data-college-media="${selId}"]`).forEach((el) => {
    el.innerHTML = imageHTML(c, v, el.dataset.hero === "true");
    bindMediaImage(el);
  });
  document
    .querySelectorAll(`[data-college-description="${selId}"]`)
    .forEach((el) => {
      el.textContent = v?.description || collegeSummary(c);
    });
  document.querySelectorAll(`[data-college-credit="${selId}"]`).forEach((el) => {
    el.innerHTML = v?.article
      ? `${external("Description: Wikipedia", v.article)} · ${external("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")}`
      : "Description based on NCES/IPEDS data.";
  });
  document
    .querySelectorAll(`[data-college-full-credit="${selId}"]`)
    .forEach((el) => {
      el.innerHTML =
        credit(v) +
        (v?.article
          ? `<p>${external("Description source: Wikipedia", v.article)} · CC BY-SA 4.0.</p>`
          : "");
    });
}
function pump() {
  while (active < 1 && queue.length) {
    const c = queue.shift();
    active++;
    enrich(c)
      .then((v) => {
        cache[c.id] = v;
        const keys = Object.keys(cache).sort(
          (a, b) => (cache[b].fetched || 0) - (cache[a].fetched || 0),
        );
        cache = Object.fromEntries(keys.slice(0, 80).map((k) => [k, cache[k]]));
        try {
          localStorage.setItem(CACHE, JSON.stringify(cache));
        } catch {
          /* Public metadata is optional. */
        }
      })
      .catch(() => {
        failed.add(c.id);
      })
      .finally(() => {
        patch(c);
        active--;
        pending.delete(c.id);
        setTimeout(pump, 900);
      });
  }
}
export async function hydrateCollegeMedia() {
  queue.length = 0;
  if (!ready) {
    try {
      const r = await fetch("./data/college-media.json");
      if (r.ok) seed = (await r.json()).records || {};
    } catch {}
    ready = true;
  }
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          observer.unobserve(e.target);
          const c = colleges.get(e.target.dataset.collegeMedia);
          if (!c) continue;
          const v = known(c);
          if (v && (seed[c.id] || Date.now() - v.fetched < THIRTY_DAYS)) {
            if (e.target.querySelector(".campus-placeholder")) patch(c);
            continue;
          }
          if (failed.has(c.id)) {
            patch(c);
            continue;
          }
          if (!pending.has(c.id)) {
            pending.add(c.id);
            queue.push(c);
            pump();
          }
        }
    },
    { rootMargin: "120px" },
  );
  document.querySelectorAll("[data-college-media]").forEach((el) => {
    const c = colleges.get(el.dataset.collegeMedia);
    const v = c ? known(c) : null;
    const isFresh = Boolean(v && (seed[c.id] || Date.now() - v.fetched < THIRTY_DAYS));
    if (c && v && el.querySelector(".campus-placeholder")) {
      patch(c);
    } else {
      bindMediaImage(el);
    }
    if (!isFresh) observer.observe(el);
  });
}
