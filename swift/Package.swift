// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "x402-swift-exact",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .library(name: "X402SwiftExact", targets: ["X402SwiftExact"]),
        .executable(name: "x402-swift-interop-client", targets: ["X402SwiftInteropClient"]),
    ],
    targets: [
        .target(name: "X402SwiftExact"),
        .executableTarget(
            name: "X402SwiftInteropClient",
            dependencies: ["X402SwiftExact"]
        ),
        .testTarget(
            name: "X402SwiftExactTests",
            dependencies: ["X402SwiftExact"]
        ),
    ]
)
