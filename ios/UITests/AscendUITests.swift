import XCTest

final class AscendUITests: XCTestCase {
    func testNativeTabsPlannerEditingAndTransfer() throws {
        let app = XCUIApplication(); app.launchArguments = ["--preview"]; app.launch()
        XCTAssertTrue(app.staticTexts["Ascend"].firstMatch.waitForExistence(timeout: 15))
        screenshot("01-Today")
        app.tabBars.buttons["Colleges"].tap()
        XCTAssertTrue(app.staticTexts["Your next chapter"].waitForExistence(timeout: 5))
        screenshot("02-Colleges")
        app.tabBars.buttons["Planner"].tap()
        XCTAssertTrue(app.segmentedControls["calendarZoom"].waitForExistence(timeout: 5))
        screenshot("03-Month")
        app.segmentedControls["calendarZoom"].buttons["Week"].tap()
        screenshot("04-Week")
        app.segmentedControls["calendarZoom"].buttons["Day"].tap()
        XCTAssertTrue(app.staticTexts["Volleyball game"].firstMatch.waitForExistence(timeout: 5))
        screenshot("05-Day")
        app.buttons["Add event on selected day"].tap()
        let title = app.textFields["recordTitle"]; XCTAssertTrue(title.waitForExistence(timeout: 5)); title.tap(); title.typeText("Native planner test")
        app.buttons["saveRecord"].tap()
        XCTAssertTrue(app.staticTexts["Native planner test"].firstMatch.waitForExistence(timeout: 5))
        app.tabBars.buttons["Workspace"].tap()
        app.buttons["Backup & transfer"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Export full backup"].waitForExistence(timeout: 5))
        screenshot("06-Transfer")
    }
    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
