import Foundation

@main struct NotionDataSourceResolverTests {
    static func main() async throws {
        let db = "11111111-1111-4111-8111-111111111111"
        let source = "22222222-2222-4222-8222-222222222222"
        var calls: [String] = []
        let resolved = try await NotionDataSourceResolver.resolve(db) { path in
            calls.append(path)
            if path == "databases/\(db)" { return ["data_sources": [["id": source]]] }
            return ["id": source]
        }
        precondition(resolved["id"] as? String == source)
        precondition(calls == ["databases/\(db)", "data_sources/\(source)"])
        for status in [400, 404] {
            calls = []
            let resolved = try await NotionDataSourceResolver.resolve(source) { path in
                calls.append(path)
                if path.hasPrefix("databases/") { throw NSError(domain: "LintNotion", code: status) }
                return ["id": source]
            }
            precondition(resolved["id"] as? String == source && calls.count == 2)
        }
        for status in [401, 403, 429, 500] {
            calls = []
            do {
                _ = try await NotionDataSourceResolver.resolve(db) { path in
                    calls.append(path); throw NSError(domain: "LintNotion", code: status)
                }
                fatalError("Must propagate authentication and service errors")
            } catch let error as NSError { precondition(error.code == status && calls.count == 1) }
        }
        let invalidLists: [[[String: Any]]] = [[], [["id":source],["id":db]], [["id":"invalid"]]]
        for sources in invalidLists {
            calls = []
            do {
                _ = try await NotionDataSourceResolver.resolve(db) { path in
                    calls.append(path); return ["data_sources": sources]
                }
                fatalError("Must reject empty, ambiguous, and invalid data sources")
            } catch { precondition(calls.count == 1) }
        }
        print("PASS: Notion database resolution, direct source IDs, 400/404 fallback, permission errors, and invalid source lists")
    }
}
