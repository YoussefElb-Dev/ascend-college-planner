import Foundation
import JavaScriptCore

/// Uses the website's audited RFC 5545 engine in JavaScriptCore, with no web view or network.
public final class CalendarEngine {
    private let context: JSContext
    public convenience init() throws {
        #if SWIFT_PACKAGE
        let url = Bundle.module.url(forResource: "calendar", withExtension: "js", subdirectory: "Resources")
        #else
        let url = Bundle.main.url(forResource: "calendar", withExtension: "js")
        #endif
        guard let url else { throw WorkspaceError.invalid("Calendar resource is missing.") }
        try self.init(script: String(contentsOf: url, encoding: .utf8))
    }
    public init(script: String) throws {
        guard let c = JSContext() else { throw WorkspaceError.invalid("Calendar engine is unavailable.") }
        context = c
        c.evaluateScript(script)
        if let error = c.exception { throw WorkspaceError.invalid(error.toString()) }
    }
    public func call(_ name: String, _ values: [JSONValue]) throws -> JSONValue {
        let encoder = JSONEncoder()
        let data = try encoder.encode(values)
        let arguments = try JSONSerialization.jsonObject(with: data) as! [Any]
        context.exception = nil
        guard let function = context.objectForKeyedSubscript("AscendCalendar")?.objectForKeyedSubscript(name), let result = function.call(withArguments: arguments) else { throw WorkspaceError.invalid("Calendar operation failed.") }
        if let error = context.exception { throw WorkspaceError.invalid(error.toString()) }
        guard let json = result.toObject() else { throw WorkspaceError.invalid("Calendar returned an empty result.") }
        let output = try JSONSerialization.data(withJSONObject: json, options: [.fragmentsAllowed])
        return try JSONDecoder().decode(JSONValue.self, from: output)
    }
    public func expand(_ records: [Entry], from: String, to: String) throws -> (events: [Entry], warnings: [String]) {
        let result = try call("expandPersonalEvents", [.array(records.map { .object($0.fields) }), .string(from), .string(to)])
        return ((result.object["events"]?.array ?? []).map { Entry($0.object) }, (result.object["warnings"]?.array ?? []).map(\.text))
    }
    public func parse(_ text: String, name: String) throws -> JSONValue { try call("parseCalendar", [.string(text), .string(name)]) }
    public func merge(_ existing: [Entry], incoming: [Entry]) throws -> JSONValue {
        try call("merge", [.array(existing.map { .object($0.fields) }), .array(incoming.map { .object($0.fields) })])
    }
    public func export(_ events: [Entry], linked: [Entry]) throws -> String {
        try call("calendarFile", [.array(events.map { .object($0.fields) }), .array(linked.map { .object($0.fields) })]).text
    }
}

public struct AgendaItem: Identifiable, Equatable {
    public let record: Entry
    public let collection: String
    public var id: String { collection + record.id + record.text("instance") }
    public var date: String { record.text("date") }
    public var title: String { record.title }
    public var time: String { record.text("time") }
    public var kind: String { record.text("kind") }
    public var recordID: String { record.text("recordId").isEmpty ? record.id : record.text("recordId") }
    public func occurs(on date: String) -> Bool { self.date <= date && (record.text("endDate").isEmpty ? self.date : record.text("endDate")) >= date }
}

extension Workspace {
    public func linkedCalendarEntries() -> [Entry] {
        var events: [Entry] = []
        for a in records("applications") where !a.text("deadline").isEmpty && !["Withdrawn", "Rejected"].contains(a.text("status")) {
            events.append(Entry(["id": .string(a.id), "title": .string(a.title + " application"), "date": .string(a.text("deadline")), "time": .string(a.text("deadlineTime")), "zone": .string(a.text("timezone")), "kind": .string("Application"), "collection": .string("applications")]))
        }
        for (key, kind) in [("tasks", "Task"), ("aid", "Financial aid"), ("scholarships", "Scholarship"), ("recommendations", "Recommendation"), ("visits", "Visit / interview"), ("tests", "Test"), ("goals", "Goal"), ("contacts", "Follow-up"), ("expenses", "Expense"), ("assignments", "Assignment"), ("prompts", "Essay prompt"), ("interviewPractice", "Interview practice")] {
            for r in records(key) where !r.text("due").isEmpty && !r.flag("done") && !["Submitted", "Done", "Canceled", "Complete", "Paid", "Waived"].contains(r.text("status")) {
                var e = r; e.set("date", r.text("due")); e.set("kind", kind); e.set("zone", r.text("timezone")); e.set("collection", key); events.append(e)
            }
        }
        return events
    }
    public func agenda(from: String, to: String, engine: CalendarEngine?) -> (items: [AgendaItem], warnings: [String]) {
        var all = linkedCalendarEntries().filter { $0.text("date") >= from && $0.text("date") <= to }.map { AgendaItem(record: $0, collection: $0.text("collection")) }
        var warnings: [String] = []
        if let engine {
            do {
                let result = try engine.expand(records("events"), from: from, to: to)
                all += result.events.map { original in
                    // The shared engine expands personal occurrences in the device's local time.
                    var local = original; local.set("sourceZone", original.text("zone")); local.set("zone", TimeZone.current.identifier)
                    return AgendaItem(record: local, collection: "events")
                }; warnings = result.warnings
            } catch { warnings.append(error.localizedDescription) }
        } else if !records("events").isEmpty { warnings.append("Calendar engine could not load. Saved events remain in your backup.") }
        return (all.sorted { ($0.date + $0.time + $0.title) < ($1.date + $1.time + $1.title) }, warnings)
    }
}
