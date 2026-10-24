import Foundation
import SwiftUI

@MainActor final class CollegeDirectory: ObservableObject {
    static let shared = CollegeDirectory()
    let colleges: [Entry]
    let metadata: [String: JSONValue]
    @Published private(set) var media: [String: Entry] = [:]
    private var attempted = Set<String>()
    private init() {
        func read(_ name: String) -> [String: JSONValue] { guard let u = Bundle.main.url(forResource: name, withExtension: "json"), let d = try? Data(contentsOf: u), let r = try? JSONDecoder().decode([String: JSONValue].self, from: d) else { return [:] }; return r }
        let directory = read("colleges"); metadata = directory; colleges = (directory["records"]?.array ?? []).map { Entry($0.object) }
        media = (read("college-media")["records"]?.object ?? [:]).mapValues { Entry($0.object) }
    }
    func record(_ id: String, workspace: Workspace) -> Entry? { (workspace.records("customColleges") + colleges).first { $0.id == id } }
    func summary(_ c: Entry) -> String { "\(c.title) is a \(c.text("type").lowercased()) institution in \(c.text("city")), \(c.text("state")). \(c.text("level").isEmpty ? "" : "It offers \(c.text("level").lowercased()) study.")" }
    func description(_ c: Entry) -> String { let text = media[c.id]?.text("description") ?? ""; return text.isEmpty ? summary(c) : text }
    private func query(_ host: String, _ params: [String: String]) async throws -> [String: JSONValue] {
        var url = URLComponents(string: "https://\(host)/w/api.php")!
        url.queryItems = (["action": "query", "format": "json"].merging(params) { _, new in new }).map { URLQueryItem(name: $0.key, value: $0.value) }
        var request = URLRequest(url: url.url!, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 10)
        request.setValue("AscendCollegePlanner/1.0 (public college profiles)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 3 * 1024 * 1024 else { throw WorkspaceError.invalid("Public source unavailable.") }
        let result = try JSONDecoder().decode([String: JSONValue].self, from: data)
        return result["query"]?.object["pages"]?.object.values.first?.object ?? [:]
    }
    func loadMedia(_ college: Entry) async {
        guard media[college.id] == nil, attempted.insert(college.id).inserted, let domain = URL(string: college.text("url"))?.host?.replacingOccurrences(of: "www.", with: "") else { return }
        do {
            let page = try await query("en.wikipedia.org", ["titles": college.title, "redirects": "1", "prop": "extracts|info|images|extlinks", "exintro": "1", "explaintext": "1", "imlimit": "100", "ellimit": "500", "inprop": "url"])
            guard page["missing"] == nil, let extract = page["extract"]?.text, !extract.isEmpty, (page["extlinks"]?.array ?? []).contains(where: { link in guard let host = URL(string: link.object["*"]?.text ?? "")?.host else { return false }; return host == domain || host.hasSuffix("." + domain) || domain.hasSuffix("." + host) }) else { return }
            var value = Entry(["description": .string(String(extract.prefix(8000))), "article": .string(page["fullurl"]?.text ?? "")])
            let images = (page["images"]?.array ?? []).map { $0.object["title"]?.text ?? "" }.filter { $0.range(of: "\\.(jpe?g|png)$", options: .regularExpression) != nil && $0.range(of: "seal|logo|flag|map|portrait|icon|signature|wordmark|athletics|sport|football|basketball|medal|plaque", options: [.regularExpression, .caseInsensitive]) == nil }.sorted { ($0.range(of: "campus|aerial|quad|main.building", options: [.regularExpression, .caseInsensitive]) == nil ? 1 : 0) < ($1.range(of: "campus|aerial|quad|main.building", options: [.regularExpression, .caseInsensitive]) == nil ? 1 : 0) }
            for title in images.prefix(2) {
                let info = try await query("commons.wikimedia.org", ["titles": title, "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "960"])
                let m = info["imageinfo"]?.array.first?.object ?? [:], ext = m["extmetadata"]?.object ?? [:]
                func text(_ key: String) -> String { (ext[key]?.object["value"]?.text ?? "").replacingOccurrences(of: "<[^>]*>", with: "", options: .regularExpression).replacingOccurrences(of: "&amp;", with: "&") }
                guard (m["width"]?.number ?? 0) >= 600, (m["width"]?.number ?? 0) / max(1, m["height"]?.number ?? 1) >= 1.15, text("LicenseShortName").range(of: "CC BY|CC0|Public domain", options: [.regularExpression, .caseInsensitive]) != nil else { continue }
                let photo: [String: JSONValue] = ["url": m["thumburl"] ?? m["url"] ?? .string(""), "page": m["descriptionurl"] ?? .string(""), "artist": .string(String(text("Artist").prefix(300))), "license": .string(text("LicenseShortName")), "licenseUrl": .string(text("LicenseUrl")), "caption": .string(String(text("ImageDescription").prefix(500)))]
                guard ["upload.wikimedia.org", "thumb.wikimedia.org"].contains(URL(string: photo["url"]!.text)?.host ?? "") else { continue }
                value.fields["photo"] = .object(photo); break
            }
            media[college.id] = value
        } catch { /* Optional public images never block local planning. */ }
    }
}
