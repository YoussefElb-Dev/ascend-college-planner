import fs from "node:fs/promises";
const schools = [
  ["166683", "Massachusetts Institute of Technology"],
  ["186131", "Princeton University"],
  ["243744", "Stanford University"],
  ["131520", "Howard University"],
  ["170976", "University of Michigan"],
  ["104151", "Arizona State University"],
  ["110662", "University of California, Los Angeles"],
  ["164465", "Amherst College"],
  ["139755", "Georgia Institute of Technology"],
  ["236948", "University of Washington"],
  ["199120", "University of North Carolina at Chapel Hill"],
  ["243780", "Purdue University"],
];
const strip = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
async function query(host, params) {
  const u = new URL(`https://${host}/w/api.php`);
  u.search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    ...params,
  });
  const r = await fetch(u, {
    headers: {
      "User-Agent": "AscendCollegePlanner/1.0 educational college directory",
    },
  });
  if (!r.ok) throw Error(r.status);
  const d = await r.json();
  return Object.values(d.query?.pages || {})[0];
}
const records =
  JSON.parse(
    await fs
      .readFile("dist/data/college-media.json", "utf8")
      .catch(() => '{"records":{}}'),
  ).records || {};
for (const [id, title] of schools) {
  if (records[id]?.photo) continue;
  await new Promise((r) => setTimeout(r, 1800));
  try {
    const page = await query("en.wikipedia.org", {
      titles: title,
      redirects: "1",
      prop: "extracts|info|images",
      exintro: "1",
      explaintext: "1",
      inprop: "url",
      imlimit: "100",
    });
    const imgs = (page.images || [])
      .filter(
        (i) =>
          /\.(jpg|jpeg|png)$/i.test(i.title) &&
          !/(seal|logo|flag|map|portrait|icon|signature|wordmark|athletics|commons|wikimedia|symbol|coat.of.arms|plaque|medal|sport|football|basketball|headshot)/i.test(
            i.title,
          ),
      )
      .sort((a, b) => score(b.title) - score(a.title));
    let photo = null;
    for (const i of imgs.slice(0, 12)) {
      const p = await query("commons.wikimedia.org", {
        titles: i.title,
        prop: "imageinfo",
        iiprop: "url|extmetadata|size",
        iiurlwidth: "1200",
      });
      const m = p?.imageinfo?.[0],
        e = m?.extmetadata || {};
      if (
        !m ||
        m.width < 600 ||
        m.width / m.height < 1.15 ||
        !/(CC BY|CC0|Public domain)/i.test(e.LicenseShortName?.value || "")
      )
        continue;
      photo = {
        url: m.thumburl || m.url,
        original: m.url,
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
    records[id] = {
      title: page.title,
      description: page.extract || "",
      article: page.fullurl,
      photo,
      fetched: Date.now(),
    };
    console.log(
      id,
      title,
      photo ? "campus photo verified" : "description only",
    );
  } catch (e) {
    console.log(id, e.message);
  }
}
await fs.writeFile(
  "dist/data/college-media.json",
  JSON.stringify({ source: "Wikipedia and Wikimedia Commons", records }),
);
function score(s) {
  return (
    (/campus|aerial|quad|main.building/i.test(s) ? 8 : 0) +
    (/hall|library|memorial|university|college/i.test(s) ? 3 : 0) -
    (/interior|statue|sculpture|artwork|night/i.test(s) ? 4 : 0)
  );
}
