// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "MaestroBridge",
    platforms: [
        .iOS(.v14),
        .macOS(.v11)
    ],
    products: [
        // Library product for iOS apps to integrate
        .library(
            name: "MaestroBridge",
            targets: ["MaestroBridge"]
        ),
    ],
    dependencies: [
        // No external dependencies - uses only Foundation networking
    ],
    targets: [
        // Main library target
        .target(
            name: "MaestroBridge",
            dependencies: [],
            path: "Sources/MaestroBridge",
            swiftSettings: [
                // Ensure debug-only compilation is enforced at build time
                .define("MAESTRO_BRIDGE_ENABLED", .when(configuration: .debug))
            ]
        ),
        // Test target
        .testTarget(
            name: "MaestroBridgeTests",
            dependencies: ["MaestroBridge"],
            path: "Tests/MaestroBridgeTests"
        ),
    ]
)
