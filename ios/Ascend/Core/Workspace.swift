import Foundation

public enum JSONValue: Codable, Equatable, Sendable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([String: JSONValue].self) { self = .object(v) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    public var text: String {
        switch self { case .string(let v): return v; case .number(let v): return v.rounded() == v ? String(format: "%.0f", v) : String(v); default: return "" }
    }
    public var flag: Bool { if case .bool(let v) = self { return v }; return false }
    public var number: Double { if case .number(let v) = self { return v }; return Double(text) ?? 0 }
    public var object: [String: JSONValue] { if case .object(let v) = self { return v }; return [:] }
    public var array: [JSONValue] { if case .array(let v) = self { return v }; return [] }
}

public struct Entry: Identifiable, Equatable, Sendable {
    public var fields: [String: JSONValue]
    public init(_ fields: [String: JSONValue] = [:]) { self.fields = fields }
    public var id: String { text("id") }
    public var title: String { let t = text("title"); return t.isEmpty ? text("name") : t }
    public func text(_ key: String) -> String { fields[key]?.text ?? "" }
    public func flag(_ key: String) -> Bool { fields[key]?.flag ?? false }
    public func number(_ key: String) -> Double { fields[key]?.number ?? 0 }
    public func entries(_ key: String) -> [Entry] { (fields[key]?.array ?? []).map { Entry($0.object) } }
    public mutating func set(_ key: String, _ value: String) { fields[key] = .string(value) }
    public mutating func set(_ key: String, _ value: Bool) { fields[key] = .bool(value) }
    public mutating func set(_ key: String, _ value: Double) { fields[key] = .number(value) }
    public mutating func set(_ key: String, entries: [Entry]) { fields[key] = .array(entries.map { .object($0.fields) }) }
    public static func new(title: String = "") -> Entry { Entry(["id": .string(UUID().uuidString), "title": .string(title), "created": .number(Date().timeIntervalSince1970 * 1000)]) }
}

public enum WorkspaceError: LocalizedError {
    case invalid(String)
    public var errorDescription: String? { switch self { case .invalid(let s): return s } }
}

public struct Workspace: Equatable, Sendable {
    public var root: [String: JSONValue]
    public static let required = ["applications", "tasks", "essays", "documents", "recommendations", "aid", "scholarships", "offers", "notes", "favorites", "compare", "customColleges", "customSchools", "notifications"]
    public static let optional = ["activities", "honors", "visits", "tests", "expenses", "goals", "contacts", "events", "dayNotes"]
    public static let maximumBytes = 12 * 1024 * 1024
    public init(root: [String: JSONValue]) { self.root = root }
    public static var empty: Workspace {
        var r: [String: JSONValue] = ["version": .number(1), "profile": .object(["name": .string(""), "graduation": .string("2027"), "major": .string(""), "highSchool": .string(""), "state": .string(""), "stage": .string("Getting started"), "questbridge": .bool(false), "theme": .string("light"), "onboarded": .bool(false)]), "questbridge": .object(["status": .string("Exploring"), "outcome": .string(""), "ranking": .array([])])]
        for k in required + optional { r[k] = .array([]) }
        return Workspace(root: r)
    }
    public var profile: Entry { get { Entry(root["profile"]?.object ?? [:]) } set { root["profile"] = .object(newValue.fields) } }
    public func records(_ key: String, archived: Bool = false) -> [Entry] { all(key).filter { $0.flag("archived") == archived } }
    public func all(_ key: String) -> [Entry] { (root[key]?.array ?? []).map { Entry($0.object) } }
    public mutating func set(_ key: String, _ entries: [Entry]) { root[key] = .array(entries.map { .object($0.fields) }) }
    public mutating func upsert(_ key: String, _ entry: Entry) {
        var list = all(key)
        if let i = list.firstIndex(where: { $0.id == entry.id }) { list[i] = entry } else { list.append(entry) }
        set(key, list)
    }
    public func entry(_ key: String, _ id: String) -> Entry? { all(key).first { $0.id == id } }
    public func collegeName(for entry: Entry) -> String { self.entry("applications", entry.text("applicationId"))?.title ?? "" }
    public static func decode(_ data: Data) throws -> Workspace {
        guard data.count <= maximumBytes else { throw WorkspaceError.invalid("Backup exceeds the 12 MB limit.") }
        let r = try JSONDecoder().decode([String: JSONValue].self, from: data)
        var w = Workspace(root: r)
        try w.validate()
        for key in optional where r[key] == nil { w.root[key] = .array([]) }
        if w.root["questbridge"] == nil { w.root["questbridge"] = empty.root["questbridge"] }
        return w
    }
    public func encoded(exported: Bool = false) throws -> Data {
        var r = root
        if exported { r["exportedAt"] = .string(ISO8601DateFormatter().string(from: Date())) }
        let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        let d = try e.encode(r)
        guard d.count <= Self.maximumBytes else { throw WorkspaceError.invalid("Workspace exceeds the 12 MB backup limit.") }
        return d
    }
    public func validate() throws {
        func fail(_ s: String) throws { throw WorkspaceError.invalid(s) }
        guard root["version"] == .number(1), case .object? = root["profile"] else { try fail("Choose an Ascend version 1 backup."); return }
        for key in Self.required { guard case .array? = root[key] else { try fail("Backup is missing \(key)."); return } }
        for key in Self.optional where root[key] != nil { guard case .array? = root[key] else { try fail("Invalid \(key) collection."); return } }
        for key in ["name", "graduation", "major", "highSchool", "state", "stage", "theme"] {
            if let v = profile.fields[key], v != .null { guard case .string = v else { try fail("Invalid profile field."); return } }
        }
        for key in ["favorites", "compare"] {
            for v in root[key]?.array ?? [] { guard Self.validID(v.text) else { try fail("Invalid saved college ID."); return } }
        }
        let stringFields = ["title", "name", "body", "notes", "tags", "status", "category", "role", "contact", "url", "city", "state", "zip", "type", "folder", "organization", "description", "grades", "location", "questions", "reflection", "subject", "score", "target", "email", "phone", "history", "level"]
        for key in (Self.required + Self.optional).filter({ !["favorites", "compare"].contains($0) }) {
            var ids = Set<String>()
            for value in root[key]?.array ?? [] {
                guard case .object = value else { try fail("Invalid \(key) record."); return }
                let r = Entry(value.object)
                guard Self.validID(r.id), ids.insert(r.id).inserted else { try fail("Invalid or duplicate \(key) ID."); return }
                for field in ["applicationId", "collegeId", "dependsOn"] where !r.text(field).isEmpty { guard Self.validID(r.text(field)) else { try fail("Invalid record association."); return } }
                for field in stringFields {
                    if let v = r.fields[field], v != .null { guard case .string = v else { try fail("Invalid \(key) \(field)."); return } }
                }
                for field in ["due", "deadline", "decisionDate", "requested", "date", "endDate", "repeatUntil"] where !(r.fields[field]?.text ?? "").isEmpty {
                    guard DateKey.date(r.text(field)) != nil else { try fail("Invalid \(key) date."); return }
                }
                for field in ["time", "deadlineTime", "endTime"] where !r.text(field).isEmpty { guard DateKey.validTime(r.text(field)) else { try fail("Invalid time."); return } }
                for field in ["amount", "hours", "weeks"] where r.fields[field] != nil && r.fields[field] != .null {
                    let raw = r.fields[field]!.text
                    guard let n = Double(raw.isEmpty ? "0" : raw), n.isFinite, n >= 0, n <= 10000000 else { try fail("Invalid amount or time commitment."); return }
                }
                if key == "applications" {
                    guard case .string? = r.fields["name"], case .array? = r.fields["requirements"], case .array? = r.fields["statusHistory"] else { try fail("Incomplete application record."); return }
                    var reqIDs = Set<String>()
                    for q in r.entries("requirements") {
                        guard Self.validID(q.id), reqIDs.insert(q.id).inserted, case .string? = q.fields["title"], (q.fields["weight"] == nil || (q.number("weight") >= 1 && q.number("weight") <= 100)) else { try fail("Invalid application checklist."); return }
                    }
                }
                if key == "tasks" { guard case .string? = r.fields["title"] else { try fail("Task needs a title."); return }; if r.fields["subtasks"] != nil { guard case .array? = r.fields["subtasks"] else { try fail("Invalid subtasks."); return } } }
                if key == "essays" {
                    guard case .string? = r.fields["title"], case .string? = r.fields["body"], case .array? = r.fields["versions"] else { try fail("Invalid essay draft."); return }
                    for v in r.entries("versions") { guard Self.validID(v.id), case .string? = v.fields["body"], case .number? = v.fields["at"] else { try fail("Invalid essay version."); return } }
                }
                if key == "documents" { try Self.validateDocument(r) }
                if key == "activities" && (r.number("hours") > 168 || r.number("weeks") > 52) { try fail("Invalid activity time commitment.") }
                if key == "events" {
                    guard DateKey.date(r.text("date")) != nil, case .bool? = r.fields["allDay"], case .string? = r.fields["title"], ["None", "Daily", "Weekly", "Monthly", "Yearly", "Imported", ""].contains(r.text("repeat")) else { try fail("Invalid personal event."); return }
                    if !r.text("endDate").isEmpty && r.text("endDate") < r.text("date") { try fail("Event end precedes start.") }
                    if !r.flag("allDay") && (!DateKey.validTime(r.text("time")) || !DateKey.validTime(r.text("endTime").isEmpty ? r.text("time") : r.text("endTime"))) { try fail("Add valid event times.") }
                    if !r.text("repeatUntil").isEmpty && r.text("repeatUntil") < r.text("date") { try fail("Repeat end precedes start.") }
                    if let interval = r.fields["repeatInterval"], interval.number < 1 || interval.number > 365 || interval.number.rounded() != interval.number { try fail("Invalid repeat interval.") }
                }
            }
        }
        if let qb = root["questbridge"] {
            guard case .object = qb else { try fail("Invalid QuestBridge record."); return }
            guard case .array? = qb.object["ranking"], (qb.object["ranking"]?.array ?? []).allSatisfy({ Self.validID($0.text) }) else { try fail("Invalid QuestBridge ranking."); return }
        }
    }
    public static func validID(_ id: String) -> Bool { id.range(of: "^[a-zA-Z0-9_-]{1,120}$", options: .regularExpression) != nil }
    public static func validateDocument(_ r: Entry) throws {
        let allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/png", "image/jpeg", "image/gif", "image/webp"]
        let parts = r.text("data").components(separatedBy: ";base64,")
        guard parts.count == 2, parts[0].hasPrefix("data:"), allowed.contains(String(parts[0].dropFirst(5))), let d = Data(base64Encoded: parts[1]), d.count <= 1024 * 1024, r.number("size") >= 0, r.number("size") <= 1024 * 1024 else { throw WorkspaceError.invalid("Invalid or unsupported document.") }
    }
    public static func progress(_ app: Entry) -> Double {
        let list = app.entries("requirements").filter { $0.fields["required"] != .bool(false) && !$0.flag("exempt") }
        let total = list.reduce(0.0) { $0 + max(1, $1.number("weight")) }
        guard total > 0 else { return 0 }
        return list.filter { $0.flag("done") }.reduce(0.0) { $0 + max(1, $1.number("weight")) } / total
    }
    public mutating func toggleRequirement(appID: String, requirementID: String) throws {
        guard var a = entry("applications", appID) else { return }
        var reqs = a.entries("requirements")
        guard let i = reqs.firstIndex(where: { $0.id == requirementID }) else { return }
        let completing = !reqs[i].flag("done")
        let dependency = reqs[i].text("dependsOn")
        if completing && !dependency.isEmpty && !reqs.contains(where: { $0.id == dependency && ($0.flag("done") || $0.flag("exempt")) }) { throw WorkspaceError.invalid("Complete the prerequisite first.") }
        reqs[i].set("done", completing); reqs[i].fields["doneAt"] = completing ? .string(DateKey.today) : .null
        if !completing {
            var pending = [requirementID]; var visited = Set<String>()
            while let parent = pending.popLast() {
                guard visited.insert(parent).inserted else { continue }
                for j in reqs.indices where reqs[j].text("dependsOn") == parent { reqs[j].set("done", false); reqs[j].fields["doneAt"] = .null; pending.append(reqs[j].id) }
            }
        }
        a.set("requirements", entries: reqs); upsert("applications", a)
    }
    public mutating func toggleTask(_ id: String) {
        guard var t = entry("tasks", id) else { return }
        let done = t.text("status") != "Done"; t.set("status", done ? "Done" : "To do"); t.fields["completedAt"] = done ? .string(ISO8601DateFormatter().string(from: Date())) : .null
        if done, ["Daily", "Weekly", "Monthly"].contains(t.text("recurrence")), t.text("nextId").isEmpty {
            var next = t; next.set("id", UUID().uuidString); next.set("status", "To do"); next.fields["completedAt"] = .null
            next.set("due", DateKey.next(t.text("due").isEmpty ? DateKey.today : t.text("due"), recurrence: t.text("recurrence")))
            next.fields.removeValue(forKey: "nextId")
            next.set("subtasks", entries: t.entries("subtasks").map { r in var q = r; q.set("done", false); return q })
            t.set("nextId", next.id); upsert("tasks", next)
        }
        upsert("tasks", t)
    }
}

public enum DateKey {
    public static var calendar: Calendar { var c = Calendar(identifier: .gregorian); c.timeZone = .current; return c }
    public static var today: String { string(Date()) }
    public static func string(_ date: Date) -> String { let c = calendar.dateComponents([.year, .month, .day], from: date); return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!) }
    public static func date(_ key: String) -> Date? {
        guard key.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil else { return nil }
        let n = key.split(separator: "-").compactMap { Int($0) }; guard n.count == 3, let d = calendar.date(from: DateComponents(year: n[0], month: n[1], day: n[2], hour: 12)), string(d) == key else { return nil }; return d
    }
    public static func validTime(_ key: String) -> Bool { key.range(of: "^(?:[01]\\d|2[0-3]):[0-5]\\d$", options: .regularExpression) != nil }
    public static func label(_ key: String) -> String { guard let d = date(key) else { return "No date set" }; return d.formatted(.dateTime.month(.abbreviated).day()) }
    public static func adding(_ days: Int, to key: String) -> String { guard let d = date(key), let result = calendar.date(byAdding: .day, value: days, to: d) else { return key }; return string(result) }
    public static func next(_ key: String, recurrence: String) -> String {
        guard let d = date(key) else { return key }
        let component: Calendar.Component = recurrence == "Monthly" ? .month : .day
        return string(calendar.date(byAdding: component, value: recurrence == "Weekly" ? 7 : 1, to: d) ?? d)
    }
}
