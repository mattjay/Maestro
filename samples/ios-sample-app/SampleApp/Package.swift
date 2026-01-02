// swift-tools-version: 5.9
// This Package.swift enables building the sample app with Swift Package Manager.
// For full Xcode project features (UI tests, asset catalogs), use the .xcodeproj.

import PackageDescription

let package = Package(
    name: "SampleApp",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "SampleAppLib",
            targets: ["SampleAppLib"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "SampleAppLib",
            dependencies: [],
            path: "Sources"
        ),
        .testTarget(
            name: "SampleAppTests",
            dependencies: ["SampleAppLib"],
            path: "Tests/SampleAppTests"
        )
    ]
)
