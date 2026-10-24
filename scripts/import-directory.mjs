#!/usr/bin/env node
/** Offline directory builder. Requires Node 22+; no npm dependencies or API keys. */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CACHE = join(tmpdir(), "ascend-official-directory-cache");
export const SOURCES = {
  ipeds: {
    name: "NCES IPEDS HD2025",
    year: "2025-26",
    url: "https://nces.ed.gov/ipeds/complete-data-files/HD2025.zip",
  },
  scorecard: {
    name: "U.S. Department of Education College Scorecard",
    year: "2026-10-15 release; mixed reporting years",
    url: "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_10152026.zip",
  },
  ccd: {
    name: "NCES CCD public school directory (preliminary 0a)",
    year: "2025-26",
    url: "https://nces.ed.gov/ccd/data/zip/ccd_sch_029_2526_w_0a_050626.zip",
  },
  pss: {
    name: "NCES PSS private school universe survey",
    year: "2023-24",
    url: "https://nces.ed.gov/surveys/pss/zip/pss2324_pu_csv.zip",
  },
};
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI FM MH PW".split(
    " ",
  ),
);
const DICTIONARY =
  "https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx";
const TYPES = { 1: "Public", 2: "Private nonprofit", 3: "Private for-profit" };
const LEVELS = { 1: "4-year or above", 2: "2-year", 3: "Less than 2-year" };
const METRICS = {
  enrollment: "UGDS",
  tuitionIn: "TUITIONFEE_IN",
  tuitionOut: "TUITIONFEE_OUT",
  admissionRate: "ADM_RATE",
};

export async function download(url, refresh = false) {
  await mkdir(CACHE, { recursive: true });
  const path = join(
    CACHE,
    createHash("sha256").update(url).digest("hex").slice(0, 16) +
      "-" +
      new URL(url).pathname.split("/").pop(),
  );
  if (!refresh) {
    try {
      return {
        buffer: await readFile(path),
        downloadedAt: (await stat(path)).mtime.toISOString(),
        cache: path,
      };
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  console.log("Downloading " + url);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (/\.zip$/i.test(url) && buffer.readUInt32LE(0) !== 0x04034b50)
        throw new Error("Expected ZIP: " + url);
      await writeFile(path, buffer);
      return {
        buffer,
        downloadedAt: (await stat(path)).mtime.toISOString(),
        cache: path,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Reads central-directory ZIP members in memory; never extracts paths to disk. */
export function unzip(buffer) {
  let end = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP central directory not found");
  const entries = [];
  const count = buffer.readUInt16LE(end + 10);
  let position = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(position) !== 0x02014b50)
      throw new Error("Invalid ZIP entry");
    const method = buffer.readUInt16LE(position + 10);
    const size = buffer.readUInt32LE(position + 20);
    const uncompressedSize = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const name = buffer.toString(
      "utf8",
      position + 46,
      position + 46 + nameLength,
    );
    const offset = buffer.readUInt32LE(position + 42);
    entries.push({
      name,
      uncompressedSize,
      read() {
        if (buffer.readUInt32LE(offset) !== 0x04034b50)
          throw new Error("Invalid ZIP local header");
        const start =
          offset +
          30 +
          buffer.readUInt16LE(offset + 26) +
          buffer.readUInt16LE(offset + 28);
        const bytes = buffer.subarray(start, start + size);
        const result =
          method === 0 ? bytes : method === 8 ? inflateRawSync(bytes) : null;
        if (!result || result.length !== uncompressedSize)
          throw new Error("Unsupported or damaged ZIP member: " + name);
        return result;
      },
    });
    position += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Handles BOM, CRLF, doubled quotes, quoted commas and embedded newlines. */
export function* csvRows(text, delimiter = ",") {
  let row = [],
    cell = "",
    quoted = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value !== "")) yield row;
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("Unterminated quoted CSV field");
  if (cell || row.length) {
    row.push(cell);
    yield row;
  }
}

export function decode(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

export function* objects(text, delimiter = ",") {
  let headers;
  for (const row of csvRows(text, delimiter)) {
    if (!headers) {
      headers = row.map((value) => value.trim().toUpperCase());
      continue;
    }
    if (row.length !== headers.length)
      throw new Error(
        `CSV row has ${row.length} cells; expected ${headers.length}`,
      );
    yield Object.fromEntries(
      headers.map((key, index) => [key, row[index].trim()]),
    );
  }
}

function xmlText(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, x) =>
      String.fromCodePoint(parseInt(x, 16)),
    )
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(+x))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Small OOXML reader for the official data dictionary, not a spreadsheet dependency. */
function sheetRows(buffer, sheetName) {
  const entries = unzip(buffer);
  const entry = (name) => {
    const match = entries.find((item) => item.name === name);
    if (!match) throw new Error("Missing workbook member " + name);
    return decode(match.read());
  };
  const workbook = entry("xl/workbook.xml");
  const sheetTag = [...workbook.matchAll(/<sheet\b[^>]+\/>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`name="${sheetName}"`));
  if (!sheetTag) throw new Error("Missing dictionary sheet " + sheetName);
  const relationshipId = sheetTag.match(/r:id="([^"]+)"/)[1];
  const relationship = [
    ...entry("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]+\/>/g),
  ]
    .map((match) => match[0])
    .find((tag) => tag.includes(`Id="${relationshipId}"`));
  const target = relationship.match(/Target="([^"]+)"/)[1];
  const path = target.startsWith("/") ? target.slice(1) : "xl/" + target;
  const shared = entries.find((item) => item.name === "xl/sharedStrings.xml");
  const strings = shared
    ? [...decode(shared.read()).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(
        (match) =>
          [...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
            .map((match) => xmlText(match[1]))
            .join(""),
      )
    : [];
  return [...entry(path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(
    (match) =>
      [...match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cell) => {
        const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1];
        return /t="s"/.test(cell[1])
          ? strings[+value]
          : value !== undefined
            ? xmlText(value)
            : [...cell[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
                .map((match) => xmlText(match[1]))
                .join("");
      }),
  );
}

function textValue(value) {
  const text = value?.trim().replace(/\s+/g, " ");
  return text &&
    !/^(?:-\d+|NULL|NA|N\/A|NOT REPORTED|NOT AVAILABLE|PRIVACYSUPPRESSED|PS|M|N|A)$/i.test(
      text,
    )
    ? text
    : undefined;
}

function numberValue(value, rate = false) {
  if (!/^\d+(?:\.\d+)?$/.test(value ?? "")) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && (!rate || number <= 1) ? number : undefined;
}

function website(value) {
  const text = textValue(value);
  if (!text || /\s/.test(text)) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : "https://" + text);
    return /^https?:$/.test(url.protocol) &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function gradeRange(grades) {
  const numeric = grades.filter((grade) => /^\d+$/.test(grade)).map(Number);
  const result = grades.filter((grade) => !/^\d+$/.test(grade));
  if (
    numeric.length &&
    numeric.every(
      (grade, index) => index === 0 || grade === numeric[index - 1] + 1,
    )
  )
    result.push(
      numeric.length === 1
        ? String(numeric[0])
        : `${numeric[0]}-${numeric.at(-1)}`,
    );
  else result.push(...numeric.map(String));
  return result.join(", ");
}

function compact(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}
function sortRecords(records) {
  return records.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.state.localeCompare(b.state, "en") ||
      a.id.localeCompare(b.id, "en"),
  );
}

function csvText(file, pattern) {
  const entry = unzip(file.buffer).find(
    (item) => pattern.test(item.name) && !item.name.startsWith("__MACOSX"),
  );
  if (!entry) throw new Error("Expected CSV missing in source ZIP");
  return decode(entry.read());
}

function sourceMetadata(key, file, rawRecords, includedRecords) {
  return {
    key,
    source: SOURCES[key].name,
    sourceUrl: SOURCES[key].url,
    year: SOURCES[key].year,
    downloadedAt: file.downloadedAt,
    sha256: createHash("sha256").update(file.buffer).digest("hex"),
    rawRecords,
    includedRecords,
  };
}

async function build(refresh) {
  const requests = await Promise.allSettled([
    ...Object.entries(SOURCES).map(async ([key, source]) => [
      key,
      await download(source.url, refresh),
    ]),
    (async () => ["dictionary", await download(DICTIONARY, refresh)])(),
  ]);
  for (const result of requests)
    if (result.status === "rejected") throw result.reason;
  const files = Object.fromEntries(requests.map((result) => result.value));
  const cohortRows = sheetRows(
    files.dictionary.buffer,
    "Most_Recent_Inst_Cohort_Map",
  );
  const cohortMap = Object.fromEntries(
    cohortRows.filter((row) => row[0]).map((row) => [row[0], row[1]]),
  );
  for (const variable of [...Object.values(METRICS), "C150_4", "C150_L4"])
    if (!cohortMap[variable])
      throw new Error("Reporting year missing for " + variable);

  const colleges = [],
    collegeIds = new Map();
  let ipedsRows = 0;
  const collegeExclusions = {};
  const excludeCollege = (reason) => {
    collegeExclusions[reason] = (collegeExclusions[reason] || 0) + 1;
  };
  for (const row of objects(csvText(files.ipeds, /^hd2025\.csv$/i))) {
    ipedsRows++;
    if (!STATES.has(row.STABBR)) {
      excludeCollege("outsideGeography");
      continue;
    }
    if (
      row.CYACTIVE !== "1" ||
      !["A", "N", "R"].includes(row.ACT) ||
      textValue(row.CLOSEDAT)
    ) {
      excludeCollege("inactiveClosedCombinedOrChildCampus");
      continue;
    }
    if (!(+row.SECTOR >= 1 && +row.SECTOR <= 9)) {
      excludeCollege("administrativeOrUnknownSector");
      continue;
    }
    if (row.OPENPUBL !== "1") {
      excludeCollege("notOpenToPublic");
      continue;
    }
    const aliases = [
      ...new Set(
        (row.IALIAS || "")
          .split(/\||;|\s{2,}/)
          .map(textValue)
          .filter((value) => value && value !== row.INSTNM),
      ),
    ];
    const locale = +row.LOCALE;
    const record = compact({
      id: row.UNITID,
      name: row.INSTNM,
      city: row.CITY,
      state: row.STABBR,
      zip: textValue(row.ZIP),
      url: website(row.WEBADDR),
      type: TYPES[row.CONTROL],
      level: LEVELS[row.ICLEVEL],
      address: textValue(row.ADDR),
      aliases: aliases.length ? aliases : undefined,
      degreeGranting: row.DEGGRANT === "1",
      undergraduate: row.UGOFFER === "1",
      graduate: row.GROFFER === "1",
      campusSetting:
        locale >= 11 && locale <= 13
          ? "City"
          : locale >= 21 && locale <= 23
            ? "Suburb"
            : locale >= 31 && locale <= 33
              ? "Town"
              : locale >= 41 && locale <= 43
                ? "Rural"
                : undefined,
      admissionsUrl: website(row.ADMINURL),
      applicationUrl: website(row.APPLURL),
      financialAidUrl: website(row.FAIDURL),
      netPriceCalculatorUrl: website(row.NPRICURL),
    });
    if (collegeIds.has(record.id))
      throw new Error("Duplicate IPEDS UNITID " + record.id);
    collegeIds.set(record.id, record);
    colleges.push(record);
  }

  let scorecardRows = 0,
    scorecardMatches = 0;
  const scorecardIds = new Set();
  for (const row of objects(
    csvText(files.scorecard, /^Most-Recent-Cohorts-Institution\.csv$/i),
  )) {
    scorecardRows++;
    if (scorecardIds.has(row.UNITID))
      throw new Error("Duplicate Scorecard UNITID " + row.UNITID);
    scorecardIds.add(row.UNITID);
    const record = collegeIds.get(row.UNITID);
    if (!record) continue; // Do not reintroduce older or closed institutions absent from current IPEDS scope.
    scorecardMatches++;
    for (const [field, variable] of Object.entries(METRICS)) {
      const number = numberValue(row[variable], field === "admissionRate");
      if (number !== undefined) record[field] = number;
    }
    const graduationMetric =
      numberValue(row.C150_4, true) !== undefined
        ? "C150_4"
        : numberValue(row.C150_L4, true) !== undefined
          ? "C150_L4"
          : undefined;
    if (graduationMetric) {
      record.graduationRate = numberValue(row[graduationMetric], true);
      record.graduationRateMetric = graduationMetric;
    }
  }

  const schools = [];
  let ccdRows = 0,
    ccdCount = 0,
    pssRows = 0,
    pssCount = 0,
    imputedPssGrades = 0;
  const schoolExclusions = {
    ccdNotOperating: 0,
    ccdNoHighSchoolGrade: 0,
    ccdOutsideGeography: 0,
    pssNoHighSchoolGrade: 0,
    pssOutsideGeography: 0,
  };
  const ccdGradeKeys = [
    "PK",
    "KG",
    ...Array.from({ length: 13 }, (_, index) => String(index + 1)),
    "UG",
    "AE",
  ];
  for (const row of objects(csvText(files.ccd, /ccd_sch_029_2526_.*\.csv$/i))) {
    ccdRows++;
    if (
      !["1", "3", "4", "5", "8"].includes(row.UPDATED_STATUS || row.SY_STATUS)
    ) {
      schoolExclusions.ccdNotOperating++;
      continue;
    }
    if (![9, 10, 11, 12].some((grade) => row[`G_${grade}_OFFERED`] === "Yes")) {
      schoolExclusions.ccdNoHighSchoolGrade++;
      continue;
    }
    const state = textValue(row.LSTATE) || row.ST;
    if (!STATES.has(state)) {
      schoolExclusions.ccdOutsideGeography++;
      continue;
    }
    const grades = ccdGradeKeys
      .filter((grade) => row[`G_${grade}_OFFERED`] === "Yes")
      .map((grade) => (grade === "KG" ? "K" : grade));
    const address = [row.LSTREET1, row.LSTREET2, row.LSTREET3]
      .map(textValue)
      .filter(Boolean)
      .join(", ");
    schools.push(
      compact({
        id: "ccd-" + row.NCESSCH,
        name: row.SCH_NAME,
        city: textValue(row.LCITY) || row.MCITY,
        state,
        zip: textValue(row.LZIP) || textValue(row.MZIP),
        type: row.CHARTER_TEXT === "Yes" ? "Public charter" : "Public",
        address: address || undefined,
        url: website(row.WEBSITE),
        grades: gradeRange(grades),
        schoolType: textValue(row.SCH_TYPE_TEXT),
        district: textValue(row.LEA_NAME),
        sourceKey: "ccd",
      }),
    );
    ccdCount++;
  }
  const pssGrades = [
    ["UG", "P135"],
    ["PK", "P145"],
    ["K", "P155"],
    ["TK", "P165"],
    ["T1", "P175"],
    ...Array.from({ length: 12 }, (_, index) => [
      String(index + 1),
      "P" + (185 + 10 * index),
    ]),
  ];
  for (const row of objects(csvText(files.pss, /^pss2324_pu\.csv$/i))) {
    pssRows++;
    if (
      !["P265", "P275", "P285", "P295"].some(
        (variable) => row[variable] === "1",
      )
    ) {
      schoolExclusions.pssNoHighSchoolGrade++;
      continue;
    }
    const state = textValue(row.PL_STABB) || row.PSTABB;
    if (!STATES.has(state)) {
      schoolExclusions.pssOutsideGeography++;
      continue;
    }
    const grades = pssGrades
      .filter(([, variable]) => row[variable] === "1")
      .map(([grade]) => grade);
    const imputedGrades = pssGrades.some(
      ([, variable]) => row[variable] === "1" && +row["F_" + variable] > 0,
    );
    if (imputedGrades) imputedPssGrades++;
    schools.push(
      compact({
        id: "pss-" + row.PPIN,
        name: row.PINST,
        city: textValue(row.PL_CIT) || row.PCITY,
        state,
        zip: textValue(row.PL_ZIP) || textValue(row.PZIP),
        type: "Private",
        address: textValue(row.PL_ADD) || textValue(row.PADDRS),
        grades: gradeRange(grades),
        sourceKey: "pss",
        gradesAdjustedOrImputed: imputedGrades || undefined,
      }),
    );
    pssCount++;
  }

  const sources = {
    ipeds: sourceMetadata("ipeds", files.ipeds, ipedsRows, colleges.length),
    scorecard: sourceMetadata(
      "scorecard",
      files.scorecard,
      scorecardRows,
      scorecardMatches,
    ),
    ccd: sourceMetadata("ccd", files.ccd, ccdRows, ccdCount),
    pss: sourceMetadata("pss", files.pss, pssRows, pssCount),
  };
  const downloadedAt = Object.values(sources)
    .map((source) => source.downloadedAt)
    .sort()
    .at(-1);
  const fieldDefinitions = {
    enrollment: {
      sourceKey: "scorecard",
      variable: "UGDS",
      description:
        "Undergraduate certificate/degree-seeking enrollment, not total institutional enrollment.",
      reportingPeriod: cohortMap.UGDS,
    },
    tuitionIn: {
      sourceKey: "scorecard",
      variable: "TUITIONFEE_IN",
      description:
        "Annual in-state tuition and required fees in USD; excludes living costs and financial aid.",
      reportingPeriod: cohortMap.TUITIONFEE_IN,
    },
    tuitionOut: {
      sourceKey: "scorecard",
      variable: "TUITIONFEE_OUT",
      description:
        "Annual out-of-state tuition and required fees in USD; excludes living costs and financial aid.",
      reportingPeriod: cohortMap.TUITIONFEE_OUT,
    },
    admissionRate: {
      sourceKey: "scorecard",
      variable: "ADM_RATE",
      description:
        "Admissions rate as a fraction from 0 to 1; absence does not imply open admission.",
      reportingPeriod: cohortMap.ADM_RATE,
    },
    graduationRate: {
      sourceKey: "scorecard",
      description:
        "Completion within 150% of normal time for first-time full-time students, as a fraction from 0 to 1. See graduationRateMetric.",
      metrics: {
        C150_4: {
          description: "Four-year institutions",
          reportingPeriod: cohortMap.C150_4,
        },
        C150_L4: {
          description: "Less-than-four-year institutions",
          reportingPeriod: cohortMap.C150_L4,
        },
      },
    },
  };
  const collegeEnvelope = {
    source: "NCES IPEDS HD2025; U.S. Department of Education College Scorecard",
    sourceUrl: SOURCES.ipeds.url,
    year: "IPEDS 2025-26; Scorecard 2026-10-15 release (mixed reporting years)",
    downloadedAt: [sources.ipeds.downloadedAt, sources.scorecard.downloadedAt]
      .sort()
      .at(-1),
    recordCount: colleges.length,
    sources: [sources.ipeds, sources.scorecard],
    documentation: [
      {
        sourceUrl: DICTIONARY,
        downloadedAt: files.dictionary.downloadedAt,
        sha256: createHash("sha256")
          .update(files.dictionary.buffer)
          .digest("hex"),
      },
    ],
    fieldDefinitions,
    coverage:
      "Active IPEDS institutions open to the public in the 50 states, DC, U.S. territories and freely associated states; includes degree, certificate, vocational and graduate institutions. Administrative units, closed/combined records and child campuses reporting through a parent are excluded.",
    limitations: [
      "IPEDS coverage is not every U.S. postsecondary provider; new and nonparticipating institutions may be absent.",
      "Directory and statistics are historical snapshots, not live current offerings or prices.",
      "Scorecard statistics are joined only by exact UNITID. Missing, suppressed and nonnumeric values are omitted.",
      "No majors, admissions deadlines, rankings, accreditation claims or application requirements are inferred.",
    ],
    records: sortRecords(colleges),
  };
  const highSchoolEnvelope = {
    source:
      "NCES CCD public school directory; NCES PSS private school universe survey",
    sourceUrl: "https://nces.ed.gov/ccd/files.asp",
    year: "Public: 2025-26 preliminary; private: 2023-24",
    downloadedAt: [sources.ccd.downloadedAt, sources.pss.downloadedAt]
      .sort()
      .at(-1),
    recordCount: schools.length,
    sources: [sources.ccd, sources.pss],
    coverage:
      "Operating public schools and PSS-listed private schools offering at least one grade 9-12. Includes combined K-12, charter, alternative, special education and career/technical schools when the source reports high-school grades.",
    limitations: [
      "CCD 2025-26 is preliminary. U.S.-affiliated overseas schools without an included physical state/territory code are excluded.",
      "PSS is a responding-school public-use file, not a complete current private-school census; nonrespondents, later openings and closures can create gaps.",
      "Schools reporting only ungraded or adult instruction are excluded because high-school grade coverage cannot be established.",
      "Private schools are from the older 2023-24 survey and PSS does not provide school website URLs in this file.",
      "Source grade flags can be imputed or adjusted by NCES; affected private records carry gradesAdjustedOrImputed. Public grade flags can also reflect NCES processing.",
      "Reported public URLs can point to a district rather than an individual school. Addresses prefer physical location and otherwise use the reported mailing address.",
    ],
    records: sortRecords(schools),
  };
  validateEnvelope(collegeEnvelope, "colleges");
  validateEnvelope(highSchoolEnvelope, "high-schools");
  const summary = {
    downloadedAt,
    collegeRecords: colleges.length,
    highSchoolRecords: schools.length,
    publicHighSchools: ccdCount,
    privateHighSchools: pssCount,
    scorecardMatchedColleges: scorecardMatches,
    collegeExclusions,
    schoolExclusions,
    privateSchoolsWithAdjustedOrImputedGrades: imputedPssGrades,
    metricCoverage: Object.fromEntries(
      [...Object.keys(METRICS), "graduationRate"].map((field) => [
        field,
        colleges.filter((record) => record[field] !== undefined).length,
      ]),
    ),
    sources: Object.values(sources),
  };
  const output = join(ROOT, "dist", "data");
  await mkdir(output, { recursive: true });
  for (const [name, data] of [
    ["colleges", collegeEnvelope],
    ["high-schools", highSchoolEnvelope],
    ["directory-metadata", summary],
  ]) {
    const content = JSON.stringify(data) + "\n";
    await writeFile(join(output, name + ".json"), content, "utf8");
    console.log(
      `${name}.json: ${data.records?.length ?? "provenance"} records; ${Buffer.byteLength(content).toLocaleString("en")} bytes`,
    );
  }
  console.log(JSON.stringify(summary, null, 2));
}

function validateEnvelope(envelope, kind) {
  for (const field of ["source", "sourceUrl", "year", "downloadedAt"])
    if (!envelope[field]) throw new Error(kind + ": missing " + field);
  if (envelope.records.length < (kind === "colleges" ? 3000 : 25000))
    throw new Error(kind + ": unexpectedly small directory");
  const ids = new Set();
  for (const record of envelope.records) {
    for (const field of ["id", "name", "city", "state", "type"])
      if (typeof record[field] !== "string" || !record[field])
        throw new Error(`${kind}: missing ${field} for ${record.id}`);
    if (ids.has(record.id))
      throw new Error(kind + ": duplicate ID " + record.id);
    ids.add(record.id);
    if (!STATES.has(record.state))
      throw new Error(kind + ": invalid jurisdiction " + record.state);
    for (const field of ["admissionRate", "graduationRate"])
      if (
        record[field] !== undefined &&
        !(record[field] >= 0 && record[field] <= 1)
      )
        throw new Error("Invalid rate " + record.id);
    for (const field of ["enrollment", "tuitionIn", "tuitionOut"])
      if (
        record[field] !== undefined &&
        !(record[field] >= 0 && Number.isFinite(record[field]))
      )
        throw new Error("Invalid statistic " + record.id);
    if (kind === "high-schools" && !record.grades)
      throw new Error("Missing school grades " + record.id);
  }
}

async function validateBundled() {
  for (const name of ["colleges", "high-schools"]) {
    const file = join(ROOT, "dist", "data", name + ".json");
    const data = JSON.parse(await readFile(file, "utf8"));
    validateEnvelope(data, name);
    console.log(`Validated ${name}: ${data.records.length} unique records`);
  }
}

export async function inspect() {
  const results = await Promise.allSettled(
    Object.entries(SOURCES).map(async ([key, source]) => {
      const file = await download(source.url);
      const entries = unzip(file.buffer);
      const csv = entries.find((entry) => /\.csv$/i.test(entry.name));
      const text = csv ? decode(csv.read()) : "";
      const sample = text ? objects(text).next().value : undefined;
      console.log(
        JSON.stringify({
          key,
          bytes: file.buffer.length,
          entries: entries.map(({ name, uncompressedSize }) => ({
            name,
            uncompressedSize,
          })),
          sample:
            key === "scorecard"
              ? Object.fromEntries(
                  Object.entries(sample).filter(([key]) =>
                    /UNITID|CURROPER|UGDS$|TUITIONFEE|ADM_RATE$|C150_4$|C150_L4$|YEAR/i.test(
                      key,
                    ),
                  ),
                )
              : sample,
        }),
      );
    }),
  );
  for (const result of results)
    if (result.status === "rejected") throw result.reason;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.includes("--inspect")) await inspect();
  else if (process.argv.includes("--validate")) await validateBundled();
  else await build(process.argv.includes("--refresh"));
}
