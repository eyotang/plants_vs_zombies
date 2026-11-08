// macOS screenshot replay: same HUD and bitmap, image-set versus a direct URL.
// Usage: swift check-hud-art.swift /absolute/production-stem /absolute/url-stem
import AppKit
import Foundation

struct Rect: Decodable, Equatable { let x, y, width, height: Double }
struct Metrics: Decodable {
    let viewport: [Double], dpr: Double, bank: Rect, sunFont: String
}
struct Star: Encodable { let width, height, pixels: Int; var aspect: Double { Double(width) / Double(height) } }
func sample(_ stem: String) throws -> (Metrics, Star) {
    let data = try Data(contentsOf: URL(fileURLWithPath: stem + ".json"))
    let m = try JSONDecoder().decode(Metrics.self, from: data)
    let png = try Data(contentsOf: URL(fileURLWithPath: stem + ".png"))
    guard let image = NSBitmapImageRep(data: png) else { fatalError("Cannot decode screenshot") }
    let scale = Double(image.pixelsWide) / m.viewport[0]
    precondition(abs(scale - m.dpr) < 0.01, "Screenshot must cover this browser window at its native density")
    let top = Double(image.pixelsHigh) - m.viewport[1] * scale
    let x0 = Int(m.bank.x * scale), x1 = Int((m.bank.x + m.bank.height * 0.862) * scale)
    let y0 = Int(top + m.bank.y * scale), y1 = Int(top + (m.bank.y + m.bank.height * 0.64) * scale)
    precondition(x0 >= 0 && y0 >= 0 && x1 <= image.pixelsWide && y1 <= image.pixelsHigh)
    var minX = x1, maxX = x0, minY = y1, maxY = y0, count = 0
    for y in y0..<y1 { for x in x0..<x1 {
        guard let c = image.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
        // Isolate the yellow sun above the number strip; exclude the brown frame.
        if c.redComponent > 0.65 && c.greenComponent > 0.65 && c.blueComponent < 0.55 {
            minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y); count += 1
        }
    }}
    precondition(count > 20, "No sun pixels in the measured HUD region")
    return (m, Star(width: maxX - minX + 1, height: maxY - minY + 1, pixels: count))
}
let (a, starA) = try sample(CommandLine.arguments[1])
let (b, starB) = try sample(CommandLine.arguments[2])
precondition(a.bank == b.bank && a.viewport == b.viewport && a.dpr == b.dpr && a.sunFont == b.sunFont,
             "Only the image-source representation may differ")
let ratio = starA.aspect / starB.aspect
let passed = abs(ratio - 1) <= 0.1
let result: [String: Any] = ["passed": passed, "production": [starA.width, starA.height],
                           "reference": [starB.width, starB.height], "relativeAspect": ratio,
                           "scope": "Sun-art distortion only; not whole-HUD pixel parity or device performance"]
print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
if !passed { exit(1) }
