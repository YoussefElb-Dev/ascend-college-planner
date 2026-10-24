import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (name) =>
  JSON.parse(
    fs.readFileSync(new URL("../dist/data/" + name, import.meta.url), "utf8"),
  );
test("curated campus media maps to real directory IDs and includes free-use attribution", () => {
  const directory = new Map(
    read("colleges.json").records.map((c) => [c.id, c]),
  );
  const records = read("college-media.json").records;
  assert.equal(Object.keys(records).length, 12);
  for (const [id, c] of Object.entries(records)) {
    assert.ok(directory.has(id));
    assert.ok(c.description.length > 150);
    assert.equal(new URL(c.article).hostname, "en.wikipedia.org");
    assert.ok(
      ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(
        new URL(c.photo.url).hostname,
      ),
    );
    assert.equal(new URL(c.photo.page).hostname, "commons.wikimedia.org");
    assert.match(c.photo.license, /CC BY|CC0|Public domain/);
    assert.ok(c.photo.artist);
    assert.ok(c.photo.licenseUrl.startsWith("https://"));
    assert.doesNotMatch(c.photo.page, /seal|wordmark|logo/i);
  }
});
