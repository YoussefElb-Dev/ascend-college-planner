// swift-tools-version: 5.9
import PackageDescription
let package = Package(
    name: "AscendCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [.library(name: "AscendCore", targets: ["AscendCore"])],
    targets: [
        .target(name: "AscendCore", path: "Ascend/Core", resources: [.copy("Resources")]),
        .testTarget(name: "AscendCoreTests", dependencies: ["AscendCore"], path: "Tests", resources: [.copy("Fixtures")])
    ]
)
