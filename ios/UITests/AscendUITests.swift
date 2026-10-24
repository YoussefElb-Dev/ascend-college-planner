import XCTest

final class AscendUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }
    func testNativeTabsPlannerEditingAndTransfer() throws {
        let app = XCUIApplication(); app.launchArguments = ["--preview"]; app.launch()
        XCTAssertTrue(app.staticTexts["Ascend"].firstMatch.waitForExistence(timeout: 15))
        screenshot("01-Today")
        app.tabBars.buttons["Colleges"].tap()
        XCTAssertTrue(app.staticTexts["Your next chapter"].waitForExistence(timeout: 5))
        screenshot("02-Colleges")
        app.tabBars.buttons["Planner"].tap()
        XCTAssertTrue(app.segmentedControls["calendarZoom"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Volleyball game"].firstMatch.isHittable, "The compact month should leave its selected-day agenda visible.")
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
    func testApplicationChecklistAndCollegeProfile() throws {
        let app = XCUIApplication(); app.launchArguments = ["--preview"]; app.launch()
        app.tabBars.buttons["Colleges"].tap()
        app.staticTexts["Cornell University"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Your checklist"].waitForExistence(timeout: 5))
        app.buttons["Reopen Application"].tap()
        XCTAssertTrue(app.buttons["Complete Application"].exists)
        app.buttons["Complete Application"].tap()
        screenshot("07-Checklist")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.segmentedControls.buttons["Explore"].tap()
        XCTAssertTrue(app.staticTexts["Princeton University"].firstMatch.waitForExistence(timeout: 8))
        app.staticTexts["Princeton University"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["About the college"].waitForExistence(timeout: 8))
        screenshot("08-College-profile")
    }
    func testMonochromeAndDarkAppearances() throws {
        let app = XCUIApplication(); app.launchArguments = ["--preview", "--monochrome"]; app.launch()
        XCTAssertTrue(app.staticTexts["Ascend"].firstMatch.waitForExistence(timeout: 10))
        screenshot("09-Monochrome")
        app.terminate(); app.launchArguments = ["--preview", "--dark"]; app.launch()
        XCTAssertTrue(app.staticTexts["Ascend"].firstMatch.waitForExistence(timeout: 10))
        screenshot("10-Dark")
    }
    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
