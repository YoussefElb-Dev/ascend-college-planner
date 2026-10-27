import XCTest
@testable import AscendCore

final class MissionTests: XCTestCase {
    func testPhaseAndStatusStayConsistentWithWebsite() {
        var task = Entry.new(title: "CSS Profile receipt"); task.set("applicationId", "a"); task.set("status", "In Progress")
        XCTAssertEqual(MissionModel.phase(task), "aid"); XCTAssertEqual(MissionModel.status(task), "In Progress")
        task.set("title", "SAT review"); XCTAssertEqual(MissionModel.phase(task), "school")
        task.set("title", "Activate portal"); XCTAssertEqual(MissionModel.phase(task), "applications")
        task.set("status", "Done"); XCTAssertEqual(MissionModel.status(task), "Done")
        XCTAssertEqual(MissionPhase.all.count, 5)
    }
}
