import Foundation

public enum StudyModel {
    public static let keys = ["courses", "assignments", "habits", "focusSessions", "prompts", "interviewPractice", "collegeScores", "weeklyReviews", "receipts", "readingList"]
    public static let factors = ["academics", "affordability", "campus", "opportunity"]
    public static func gpa(_ courses: [Entry]) -> Double? {
        var credits = 0.0, points = 0.0
        for c in courses where !c.flag("archived") && c.number("credits") > 0 && !c.text("gradePoints").isEmpty { credits += c.number("credits"); points += c.number("gradePoints") * c.number("credits") }
        return credits > 0 ? points / credits : nil
    }
    public static func fit(_ r: Entry, weights: [String: JSONValue]) -> Double? {
        var sum = 0.0, total = 0.0
        for k in factors where !r.text(k).isEmpty && r.number(k) >= 1 && r.number(k) <= 5 { let weight = max(0, weights[k]?.number ?? 1); sum += r.number(k) * weight; total += weight }
        return total > 0 ? sum / total : nil
    }
    public static func streak(_ habit: Entry, today: String) -> Int {
        let dates = Set(habit.fields["doneDates"]?.array.map(\.text) ?? [])
        var day = dates.contains(today) ? today : DateKey.adding(-1, to: today), n = 0
        while dates.contains(day) && n < 100000 { n += 1; day = DateKey.adding(-1, to: day) }
        return n
    }
    public static func validate(_ w: Workspace) throws {
        let ranges: [String: [(String, Double, Double)]] = ["courses": [("credits",0,30),("gradePoints",0,4)], "assignments": [("minutes",0,1440)], "focusSessions": [("minutes",1,1440)], "prompts": [("limit",0,100000)], "interviewPractice": [("confidence",1,5)], "collegeScores": factors.map { ($0,1,5) }]
        for key in keys { for r in w.all(key) {
            guard case .string? = r.fields["title"] else { throw WorkspaceError.invalid("A studio record needs a title.") }
            for field in ["teacher","schedule","course","question","situation","task","action","result","confirmation","wins","blockers","next"] {
                if let value=r.fields[field], value != .null { guard case .string = value else { throw WorkspaceError.invalid("Invalid \(field).") } }
            }
            for (field, lower, upper) in ranges[key] ?? [] where r.fields[field] != nil && r.fields[field] != .null {
                let value=r.fields[field]!
                switch value { case .number, .string: break; default: throw WorkspaceError.invalid("Invalid \(field).") }
                if value.text.isEmpty { continue }
                guard let n = Double(value.text), n.isFinite, n >= lower && n <= upper else { throw WorkspaceError.invalid("\(field) must be between \(lower) and \(upper).") }
            }
            if key == "habits", let values = r.fields["doneDates"] {
                guard case .array = values, values.array.allSatisfy({ DateKey.date($0.text) != nil }), Set(values.array.map(\.text)).count == values.array.count else { throw WorkspaceError.invalid("Invalid habit check-ins.") }
            }
        } }
        if let weights = w.profile.fields["decisionWeights"] {
            guard case .object = weights, factors.allSatisfy({ k in guard case .number(let n)? = weights.object[k] else { return false }; return n.isFinite && n >= 0 && n <= 100 }), factors.contains(where: { (weights.object[$0]?.number ?? 0) > 0 }) else { throw WorkspaceError.invalid("Choose valid decision weights with at least one positive factor.") }
        }
    }
}
