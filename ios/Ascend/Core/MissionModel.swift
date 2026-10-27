import Foundation

public struct MissionPhase: Identifiable {
    public let id: String
    public let title: String
    public let symbol: String
    public static let all = [
        MissionPhase(id: "applications", title: "Applications & portals", symbol: "building.columns"),
        MissionPhase(id: "writing", title: "Essays & your story", symbol: "pencil.line"),
        MissionPhase(id: "aid", title: "Scholarships & aid", symbol: "banknote"),
        MissionPhase(id: "school", title: "Academics & activities", symbol: "rosette"),
        MissionPhase(id: "planning", title: "Life & planning", symbol: "calendar")
    ]
}

public enum MissionModel {
    public static let statuses = ["To do", "In Progress", "Done", "Waiting"]
    public static func status(_ task: Entry) -> String {
        switch task.text("status").lowercased() {
        case "done", "complete", "completed": return "Done"
        case "in progress", "in-progress": return "In Progress"
        case "waiting", "blocked": return "Waiting"
        default: return "To do"
        }
    }
    public static func phase(_ task: Entry) -> String {
        let text = (task.text("category") + " " + task.title).lowercased()
        func matches(_ pattern: String) -> Bool { text.range(of: pattern, options: .regularExpression) != nil }
        if matches(#"financial|\baid\b|fafsa|css|idoc|tax|scholarship|pfaa|w-?2"#) { return "aid" }
        if matches(#"essay|writing|draft|recommend|short.answer|graded.paper"#) { return "writing" }
        if matches(#"test|\bsat\b|\bact\b|course|academic|activity|activities|transcript|overgrad"#) { return "school" }
        if !task.text("applicationId").isEmpty || matches("application|portal|supplement|questionnaire|college|admission") { return "applications" }
        return "planning"
    }
}
