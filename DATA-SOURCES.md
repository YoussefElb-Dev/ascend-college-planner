# Ascend offline school directories

The files in `dist/data/` contain real federal directory records. The browser can load these bundled static assets without an external API, credentials, or sending student information. `scripts/import-directory.mjs` is a build-time importer using only Node built-ins (Node 22+); it does not run in the application.

## Included snapshot

Retrieved October 22, 2026 in America/New_York (October 23 UTC). Individual UTC download timestamps, original archive SHA-256 hashes, source URLs, raw counts, and included counts are embedded in the JSON. Years below are reporting years, not retrieval dates.

| Output                              | Records | Coverage                                                                                                   |
| ----------------------------------- | ------: | ---------------------------------------------------------------------------------------------------------- |
| `dist/data/colleges.json`           |   5,836 | Active IPEDS postsecondary institutions, including degree, certificate, vocational, and graduate providers |
| `dist/data/high-schools.json`       |  37,921 | 29,171 public schools plus 8,750 private schools offering at least one grade 9–12                          |
| `dist/data/directory-metadata.json` |       — | Source manifests, counts, exclusions, and metric availability                                              |

Both directory files use `{source, sourceUrl, year, downloadedAt, recordCount, sources, records, ...}`. Missing optional fields are omitted. Values are not replaced with estimates or placeholders. Names and capitalization are preserved from the source; duplicate names are retained when their official IDs differ.

## Official downloads

| Dataset                                        | Selected release                                                                 | Direct source                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| NCES IPEDS directory                           | HD2025, 2025–26, provisional                                                     | [HD2025 ZIP](https://nces.ed.gov/ipeds/complete-data-files/HD2025.zip)                                                 |
| U.S. Department of Education College Scorecard | Most Recent Cohorts, institution level, October 15, 2026                         | [Institution ZIP](https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_10152026.zip) |
| NCES Common Core of Data                       | 2025–26 public school directory, preliminary 0a; archive identifier dated 050626 | [CCD ZIP](https://nces.ed.gov/ccd/data/zip/ccd_sch_029_2526_w_0a_050626.zip)                                           |
| NCES Private School Universe Survey            | 2023–24 public-use data, released September 2026                                 | [PSS CSV ZIP](https://nces.ed.gov/surveys/pss/zip/pss2324_pu_csv.zip)                                                  |

The Scorecard download URL is published on the [official data page](https://collegescorecard.ed.gov/data/); its October changes are described in the [official release log](https://collegescorecard.ed.gov/data/changelog/). The NCES releases are listed in the [IPEDS complete files](https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx?gotoReportId=7), [CCD file tool](https://nces.ed.gov/ccd/files.asp), and [PSS downloads](https://nces.ed.gov/surveys/pss/pssdata.asp). CCD's file-tool lookup for the selected year is [the official 2025–26 listing](https://nces.ed.gov/ccd/datatables/api/File/2/7/40/0/0/0).

Definitions were checked against the [HD2025 dictionary](https://nces.ed.gov/ipeds/complete-data-files/HD2025_Dict.zip), [Scorecard dictionary](https://collegescorecard.ed.gov/files/CollegeScorecardDataDictionary.xlsx), and [PSS SPSS labels](https://nces.ed.gov/surveys/pss/zip/pss2324_pu_sps.zip). The importer reads the Scorecard workbook's `Most_Recent_Inst_Cohort_Map` sheet to populate reporting periods instead of assuming that every metric shares a year.

## College normalization

`id` is the NCES/IPEDS `UNITID`, retained as a string. Directory identity and URLs come from HD2025. College Scorecard metrics are joined by exact `UNITID`; Scorecard-only records are not added because they may be outside the current directory's active scope. Of 6,278 Scorecard rows, 5,806 match included directory records.

The import includes `CYACTIVE=1`, `ACT` in `A/N/R`, `OPENPUBL=1`, sectors 1–9, and no reported closure date. It includes the 50 states, DC, U.S. territories, and the freely associated states represented in IPEDS. From 5,985 HD2025 rows, 149 are excluded: 75 inactive/closed/combined/parent-reporting child records, 72 administrative or unknown-sector records, and two not open to the public. Providers need not award degrees to appear; use `degreeGranting`, `undergraduate`, `graduate`, and `level` when filtering.

`type` is `Public`, `Private nonprofit`, or `Private for-profit`; `level` is `4-year or above`, `2-year`, or `Less than 2-year`. `aliases` contains only source-reported aliases, split on source delimiters. No additional acronyms or historical names are invented. `campusSetting` is derived from the official locale category. Website, admissions, application, financial-aid, and net-price-calculator URLs are source-reported; a missing scheme is normalized to HTTPS. This does not verify that a website remains active or supports HTTPS.

| Field            | Source variable       | Meaning and reporting period                                                               | Available records |
| ---------------- | --------------------- | ------------------------------------------------------------------------------------------ | ----------------: |
| `enrollment`     | `UGDS`                | Undergraduate certificate/degree-seeking students, fall 2024; not total enrollment         |             5,483 |
| `tuitionIn`      | `TUITIONFEE_IN`       | Annual in-state tuition and required fees, USD, 2025–26                                    |             3,369 |
| `tuitionOut`     | `TUITIONFEE_OUT`      | Annual out-of-state tuition and required fees, USD, 2025–26                                |             3,369 |
| `admissionRate`  | `ADM_RATE`            | Fall 2024 admissions rate, fraction from 0 to 1                                            |             1,912 |
| `graduationRate` | `C150_4` or `C150_L4` | Completion within 150% of normal time, first-time full-time students, fraction from 0 to 1 |             5,130 |

Tuition excludes living costs, grants, scholarships, and loans; it is not net price or a current financial-aid offer. Missing admission rates do not mean open admission. Graduation rates are not outcomes for all students: `graduationRateMetric` identifies the metric used. `C150_4` uses the fall 2019/2019–20 entering cohort at four-year institutions; `C150_L4` uses fall 2022/2022–23 at shorter programs, both reported in IPEDS 2025–26. Full periods from the dictionary are in `fieldDefinitions`.

Null, suppressed, negative sentinel, and nonnumeric values are omitted. Provider-published values may themselves have been imputed or processed by the federal source; Ascend adds no statistical imputations. No majors/program offerings, rankings, application deadlines, scholarship deadlines, accreditation judgments, or admissions requirements are inferred.

## High-school normalization

`id` is `ccd-` plus the 12-character NCES school ID or `pss-` plus the PSS permanent ID. Leading zeros are preserved. `sourceKey` selects the corresponding `sources` entry and reporting year. `type` is `Public`, `Public charter`, or `Private`; the public `schoolType` retains regular, special-education, alternative, and career/technical classifications. Public records also include the reported district.

For CCD, operating status codes 1, 3, 4, 5, and 8 are retained using updated status when present. At least one `G_9_OFFERED` through `G_12_OFFERED` flag must say `Yes`. Of 102,102 source rows, 1,934 fail operating status and another 70,997 do not report a high-school grade. The resulting 29,171 records include combined and special-purpose schools serving high-school grades, not just schools named “High School.” Closed, future, and inactive schools are excluded.

For PSS, at least one of `P265/P275/P285/P295` must equal 1 (grades 9/10/11/12 offered). This includes 8,750 of the 22,510 public-use rows. Eleven included private records contain NCES adjustments or imputations in at least one offered-grade flag and are marked `gradesAdjustedOrImputed: true`. PSS weights are not used to invent or duplicate schools.

`grades` is a display string based on offered-grade flags (for example `9-12` or `PK, K, 1-12`). Abbreviations: PK = prekindergarten, K = kindergarten, TK = transitional kindergarten, T1 = transitional first grade, UG = ungraded, AE = adult education. Only consecutive numeric grades are collapsed into ranges. City, state, ZIP, and address prefer the reported physical location, with mailing location used when physical information is absent. Five-digit ZIP strings retain leading zeros. Public website fields can point to the district; the PSS file has no website field, so private URLs are omitted.

## Known coverage limits

- Federal reporting snapshots can lag openings, closures, mergers, name changes, and current prices. A record is not a guarantee that a school is operating today.
- IPEDS is broad but does not capture every postsecondary provider. Administrative units and child campuses whose data are reported by a parent are deliberately excluded from this active institution list.
- CCD 2025–26 is a preliminary release. PSS 2023–24 is older and contains responding schools; private nonrespondents and later openings can be missing. PSS coverage is the 50 states and DC, while CCD can also contain U.S. territories.
- Ungraded-only and adult-only schools cannot be confirmed as offering grades 9–12 and are omitted. Homeschools and providers outside the federal survey definitions are not a complete part of these directories.
- Statistics are unavailable for some institutions. The bundled data intentionally omits unreported or suppressed fields and offers no inferred majors, admissions chances, deadlines, or scholarship eligibility.

## Rebuild and validation

From the `ascend` folder:

```powershell
node scripts/import-directory.mjs
node scripts/import-directory.mjs --validate
```

The first command uses the pinned official downloads above and caches the original archives in the operating-system temporary folder `ascend-official-directory-cache`. Use `--refresh` to download those pinned releases again. This flag does not automatically select a new release: update the source constants and verify the official dictionaries before changing vintages. `--inspect` prints source members and sample fields. A normal rebuild writes only the three JSON files in `dist/data/` after parsing and validation succeed. A download or parse failure aborts instead of generating seed data.

The validator checks required envelope/identity fields, unique IDs, jurisdiction codes, nonnegative statistics, rates in the 0–1 interval, grade availability, and minimum expected coverage. The CSV parser handles quoted commas, escaped quotes, BOMs, and embedded line breaks; ZIP members are decompressed in memory. No source archive is included in the public bundle. No student records are involved in downloading, joining, or validation.

## Optional descriptions and campus photographs

`dist/data/college-media.json` contains public metadata for 12 manually mapped institution/article pairs, retrieved October 23, 2026 by `scripts/seed-college-media.mjs`. Descriptions are Wikipedia article introductions (CC BY-SA 4.0); each entry includes its article URL. Campus images are Wikimedia Commons files, selected from those articles, excluding seals/logos/portraits and requiring free-use license metadata and landscape image dimensions. The entry stores the file page, artist, image description, license, and license URL. Credits appear on images and in profile sources.

Additional browser lookups use exact institution titles (with a small explicit alias map) and require the official institution domain in the matched article’s external links. Ambiguous or missing matches fall back to the bundled NCES/IPEDS description. Public metadata is optional and separate from the personal workspace. No student notes, events, documents, or application records are sent to Wikipedia or Commons. Tuition and outcome figures continue to come from the pinned federal snapshot; Wikipedia descriptions do not replace them.
