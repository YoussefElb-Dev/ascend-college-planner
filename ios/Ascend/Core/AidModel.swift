import Foundation

public enum AidModel {
    public static func isAid(_ item: Entry) -> Bool {
        if !item.text("domain").isEmpty { return item.text("domain") == "aid" }
        return (item.text("category") + " " + item.title).range(of: #"\bfafsa\b|\bcss\b|financial[ -]aid|\baid documents?\b|\baid requirements?\b|\bpfaa\b|\bidoc\b|tax return|tax documents?|non.tax.filer|\bw-?2\b"#, options: [.regularExpression, .caseInsensitive]) != nil
    }
    public static func category(_ item: Entry) -> String {
        let text = item.text("category") + " " + item.title
        let fafsa = text.range(of: #"\bfafsa\b"#, options: [.regularExpression, .caseInsensitive]) != nil
        let css = text.range(of: #"\bcss\b"#, options: [.regularExpression, .caseInsensitive]) != nil
        return fafsa && !css ? "FAFSA" : css && !fafsa ? "CSS Profile" : "Other aid"
    }
    public static func admissions(_ app: Entry) -> [Entry] { app.entries("requirements").filter { !isAid($0) } }
    public static func records(_ workspace: Workspace, category: String) -> [Entry] {
        let records = workspace.records("aid"), migrated = Set(records.map { $0.text("sourceRequirementId") }.filter { !$0.isEmpty })
        let legacy = workspace.records("applications").flatMap { app in app.entries("requirements").filter { isAid($0) && !migrated.contains($0.id) }.map { item in
            var row = item; row.set("applicationId", app.id); row.set("legacy", true); row.set("status", item.flag("done") ? "Complete" : "Not Started"); return row
        } }
        return (records + legacy).filter { self.category($0) == category }
    }
    public static func isComplete(_ item: Entry) -> Bool { ["Complete", "Not applicable"].contains(item.text("status")) }
}
