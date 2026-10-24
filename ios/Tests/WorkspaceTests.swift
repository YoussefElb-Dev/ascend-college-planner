import XCTest
@testable import AscendCore

final class WorkspaceTests: XCTestCase {
    func fixture() throws -> Workspace { try Workspace.decode(Data(contentsOf: Bundle.module.url(forResource: "workspace", withExtension: "json", subdirectory: "Fixtures")!)) }
    func testCompleteWebsiteBackupRoundTripsWithoutDroppingFields() throws {
        let input = try fixture(), output = try Workspace.decode(input.encoded())
        XCTAssertEqual(input, output)
        XCTAssertEqual(output.all("applications").first?.fields["futureNativeField"], input.all("applications").first?.fields["futureNativeField"])
        XCTAssertEqual(output.all("documents").first?.text("data"), input.all("documents").first?.text("data"))
        XCTAssertEqual(output.all("essays").first?.entries("versions"), input.all("essays").first?.entries("versions"))
        XCTAssertEqual(output.root["questbridge"], input.root["questbridge"])
        if let file = ProcessInfo.processInfo.environment["ASCEND_ROUNDTRIP_OUTPUT"] { try output.encoded(exported: true).write(to: URL(fileURLWithPath: file)) }
    }
    func testReopeningRequirementCascadesAndCannotSkipDependency() throws {
        var w = try fixture(); XCTAssertEqual(Workspace.progress(w.all("applications")[0]), 1)
        try w.toggleRequirement(appID: "app-1", requirementID: "req-1")
        XCTAssertEqual(w.all("applications")[0].entries("requirements").filter { $0.flag("done") }.count, 0)
        XCTAssertThrowsError(try w.toggleRequirement(appID: "app-1", requirementID: "req-3"))
        try w.toggleRequirement(appID: "app-1", requirementID: "req-1")
        XCTAssertEqual(Workspace.progress(w.all("applications")[0]), 0.5)
    }
    func testMonthlyTaskCreatesOneClampedNextOccurrence() throws {
        var w = try fixture(); w.toggleTask("task-1")
        XCTAssertEqual(w.all("tasks").count, 2)
        let next = w.all("tasks").first { $0.id != "task-1" }!
        XCTAssertEqual(next.text("due"), "2027-02-28")
        XCTAssertFalse(next.entries("subtasks")[0].flag("done"))
        w.toggleTask("task-1"); w.toggleTask("task-1"); XCTAssertEqual(w.all("tasks").count, 2)
        try w.validate()
    }
    func testInvalidInputIsRejectedBeforeReplacement() throws {
        var w = try fixture(); w.root["version"] = .number(99); XCTAssertThrowsError(try w.validate())
        w = try fixture(); var e = w.all("events")[0]; e.set("date", "2027-02-30"); w.upsert("events", e); XCTAssertThrowsError(try w.validate())
        w = try fixture(); var doc = w.all("documents")[0]; doc.set("data", "data:text/html;base64,PGgxPnRlc3Q8L2gxPg=="); w.upsert("documents", doc); XCTAssertThrowsError(try w.validate())
        w = try fixture(); w.set("tasks", w.all("tasks") + w.all("tasks")); XCTAssertThrowsError(try w.validate())
        XCTAssertThrowsError(try Workspace.decode(Data(repeating: 0, count: Workspace.maximumBytes + 1)))
    }
    func testLinkedAgendaOmitsFinishedTasksAndIncludesDeadline() throws {
        var w = try fixture(); let initial = w.linkedCalendarEntries(); XCTAssertTrue(initial.contains { $0.text("kind") == "Application" }); XCTAssertTrue(initial.contains { $0.id == "task-1" })
        w.toggleTask("task-1"); XCTAssertFalse(w.linkedCalendarEntries().contains { $0.id == "task-1" })
    }
    func engine() throws -> CalendarEngine { try CalendarEngine() }
    func testNativeCalendarUsesSameRulesAndPreservesUIDs() throws {
        let engine = try engine(), text = try String(contentsOf: Bundle.module.url(forResource: "recurring", withExtension: "ics", subdirectory: "Fixtures")!, encoding: .utf8)
        let parsed = try engine.parse(text, name: "Synthetic calendar")
        let incoming = (parsed.object["records"]?.array ?? []).map { Entry($0.object) }
        let first = try engine.merge([], incoming: incoming), records = (first.object["records"]?.array ?? []).map { Entry($0.object) }
        XCTAssertEqual(first.object["added"]?.number, 1)
        XCTAssertEqual(try engine.merge(records, incoming: incoming).object["unchanged"]?.number, 1)
        let expanded = try engine.expand(records, from: "2027-01-01", to: "2027-01-31")
        XCTAssertEqual(expanded.events.map { $0.text("date") }, ["2027-01-04", "2027-01-18", "2027-01-25"])
        XCTAssertTrue(expanded.warnings.isEmpty)
        let exported = try engine.export(records, linked: [])
        XCTAssertTrue(exported.contains("UID:game@example.test")); XCTAssertTrue(exported.contains("EXDATE:")); XCTAssertTrue(exported.contains("RRULE:"))
        let reimport = try engine.parse(exported, name: "Reimport"); XCTAssertEqual(reimport.object["records"]?.array.count, 1)
    }
}
