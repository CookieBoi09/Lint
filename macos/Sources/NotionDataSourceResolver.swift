import Foundation

// A database URL identifies the container, not the data source queried for rows.
// Notion can return either 400 (wrong object type) or 404 for the other endpoint.
enum NotionDataSourceResolver {
    static func resolve(_ id: String, get: (String) async throws -> [String: Any]) async throws -> [String: Any] {
        let database: [String: Any]
        do { database = try await get("databases/\(id)") }
        catch let error as NSError where error.domain == "LintNotion" && [400, 404].contains(error.code) {
            return try await get("data_sources/\(id)")
        }
        guard let sources = database["data_sources"] as? [[String: Any]], !sources.isEmpty else {
            throw failure("The database has no accessible data source. Share the original database with your Notion integration.")
        }
        guard sources.count == 1 else {
            throw failure("This database has multiple data sources. Enter the specific data source ID in Connect Notion.")
        }
        guard let source = sources[0]["id"] as? String, UUID(uuidString: source) != nil else {
            throw failure("Notion returned an invalid data source ID.")
        }
        return try await get("data_sources/\(source)")
    }
    private static func failure(_ message: String) -> NSError {
        NSError(domain: "LintNotion", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
