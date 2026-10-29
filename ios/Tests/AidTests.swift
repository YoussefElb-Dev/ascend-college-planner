import XCTest
@testable import AscendCore

final class AidTests: XCTestCase {
    func testAidNeverLowersAdmissionsProgressAndDomainsTakePriority() {
        var app = Entry.new(title: "Example college"), admission = Entry.new(title: "School transcript"), aid = Entry.new(title: "CSS Profile")
        admission.set("required", true); admission.set("done", true); aid.set("required", true); aid.set("done", false)
        app.set("requirements", entries: [admission, aid]); XCTAssertEqual(Workspace.progress(app), 1)
        aid.set("domain", "admissions"); app.set("requirements", entries: [admission, aid]); XCTAssertEqual(Workspace.progress(app), 0.5)
        XCTAssertFalse(AidModel.isAid(Entry(["title": .string("Financial support statement")])))
    }
    func testAidCategoriesRetainLegacyRowsAndOmitMigratedDuplicates() {
        var workspace = Workspace.empty, app = Entry.new(title: "Example"), legacy = Entry.new(title: "FAFSA"), migrated = Entry.new(title: "FAFSA")
        legacy.set("domain", "aid"); legacy.set("done", false); app.set("requirements", entries: [legacy]); workspace.upsert("applications", app)
        XCTAssertEqual(AidModel.records(workspace, category: "FAFSA").count, 1)
        migrated.set("sourceRequirementId", legacy.id); migrated.set("status", "Submitted"); workspace.upsert("aid", migrated)
        XCTAssertEqual(AidModel.records(workspace, category: "FAFSA").count, 1); XCTAssertFalse(AidModel.isComplete(migrated))
        XCTAssertEqual(AidModel.category(Entry(["title": .string("FAFSA / CSS Profile review")])), "Other aid")
    }
}
