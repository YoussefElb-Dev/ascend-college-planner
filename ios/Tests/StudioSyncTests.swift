import XCTest
@testable import AscendCore

final class StudioSyncTests: XCTestCase {
    func testGPACountsZeroAndSkipsMissingGrades() {
        let courses=[Entry(["credits":.number(3),"gradePoints":.number(4)]),Entry(["credits":.number(1),"gradePoints":.number(0)]),Entry(["credits":.number(10),"gradePoints":.string("")])]
        XCTAssertEqual(StudyModel.gpa(courses),3)
    }
    func testStreaksAndWeightedFit() {
        let habit=Entry(["doneDates":.array([.string("2026-12-31"),.string("2027-01-01")])])
        XCTAssertEqual(StudyModel.streak(habit,today:"2027-01-02"),2)
        XCTAssertEqual(StudyModel.fit(Entry(["academics":.number(5),"campus":.number(1)]),weights:["academics":.number(3),"campus":.number(1)]),4)
    }
    func testStudioValidationAndRoundTrip() throws {
        var w=Workspace.empty;var course=Entry.new(title:"Calculus");course.set("credits",3.0);course.set("gradePoints",4.0);w.upsert("courses",course);try w.validate();XCTAssertEqual(try Workspace.decode(w.encoded()),w)
        course.set("gradePoints",5.0);w.upsert("courses",course);XCTAssertThrowsError(try w.validate())
    }
    func testEncryptedWebsiteFixtureAndNativeExport() throws {
        let url=Bundle.module.url(forResource:"encrypted-sync",withExtension:"json",subdirectory:"Fixtures")!
        let key=Data(repeating:7,count:32).base64EncodedString()
        let w=try SyncCrypto.open(Data(contentsOf:url),key:key)
        XCTAssertEqual(w.profile.text("name"),"Synthetic Test")
        let encrypted=try SyncCrypto.seal(w,key:key)
        XCTAssertEqual(try SyncCrypto.open(encrypted,key:key),w)
        XCTAssertThrowsError(try SyncCrypto.open(encrypted,key:SyncCrypto.newKey()))
        if let file=ProcessInfo.processInfo.environment["ASCEND_ENCRYPTED_ROUNDTRIP"] {try encrypted.write(to:URL(fileURLWithPath:file))}
    }
    func testConflictingCopiesRequireReview() {
        XCTAssertEqual(SyncCrypto.decision(local:"left",remote:"right",baseline:"old"),"conflict")
        XCTAssertEqual(SyncCrypto.decision(local:"old",remote:"new",baseline:"old"),"pull")
        XCTAssertEqual(SyncCrypto.decision(local:"new",remote:"old",baseline:"old"),"push")
    }
}
