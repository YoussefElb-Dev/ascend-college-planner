// Explicit domains take priority; older backups are classified without losing records.
export function isAidRequirement(item = {}) {
  if (item.domain) return item.domain === "aid";
  return /\bfafsa\b|\bcss\b|financial[ -]aid|\baid documents?\b|\baid requirements?\b|\bpfaa\b|\bidoc\b|tax return|tax documents?|non.tax.filer|\bw-?2\b/i.test(`${item.category || ""} ${item.title || ""}`);
}
export function aidCategory(item = {}) {
  const text = `${item.category || ""} ${item.title || ""}`;
  if (/\bfafsa\b/i.test(text) && !/\bcss\b/i.test(text)) return "FAFSA";
  if (/\bcss\b/i.test(text) && !/\bfafsa\b/i.test(text)) return "CSS Profile";
  return "Other";
}
export function admissionsRequirements(app = {}) {
  return (app.requirements || []).filter(item => !isAidRequirement(item));
}
export function aidRecords(state, category) {
  const records = (state.aid || []).filter(item => !category || aidCategory(item) === category);
  const migrated = new Set(records.map(item => item.sourceRequirementId).filter(Boolean));
  const legacy = (state.applications || []).flatMap(app => (app.requirements || [])
    .filter(item => isAidRequirement(item) && !migrated.has(item.id) && (!category || aidCategory(item) === category))
    .map(item => ({...item, applicationId:app.id, legacy:true, status:item.done ? "Complete" : "Not Started"})));
  return [...records, ...legacy];
}
export function aidIsComplete(record) {
  return ["Complete", "Not applicable"].includes(record.status);
}
export function cssSubmissionSummary(state) {
  const records=aidRecords(state,"CSS Profile");
  const submitted=records.filter(record=>record.status==="Complete"&&/^\d{4}-\d{2}-\d{2}$/.test(record.submissionDate||""));
  const schools=[...new Map(submitted.filter(record=>record.applicationId).map(record=>[record.applicationId,record])).values()];
  const filing=submitted.find(record=>!record.applicationId);
  return {submitted:Boolean(filing),date:filing?.submissionDate||"",schools,received:schools.filter(record=>record.receiptStatus==="Received").length};
}
