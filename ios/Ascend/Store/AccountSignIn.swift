import AuthenticationServices
import CryptoKit
import Security
import UIKit

@MainActor final class AccountSignIn: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var busy = false
    private var session: ASWebAuthenticationSession?
    private let origin = "https://ascend-college-planner.vercel.app"
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
    func connect(to sync: DeviceSyncStore) async throws {
        guard !busy else { return }; busy = true; defer { busy = false; session = nil }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw WorkspaceError.invalid("Could not start secure sign-in. Try again.") }
        func urlBase64(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
        let verifier = urlBase64(Data(bytes)), challenge = urlBase64(Data(SHA256.hash(data: Data(verifier.utf8))))
        let url = URL(string: origin + "/api/account?mode=login&native=1&challenge=" + challenge)!
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let auth = ASWebAuthenticationSession(url: url, callbackURLScheme: "ascend") { url, error in
                if let error { continuation.resume(throwing: error) }
                else if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: WorkspaceError.invalid("Sign-in did not finish.")) }
            }
            auth.presentationContextProvider = self; session = auth
            if !auth.start() { continuation.resume(throwing: WorkspaceError.invalid("Could not open sign-in. Try again.")) }
        }
        guard callback.scheme == "ascend", callback.host == "signin", let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false), let ticket = parts.queryItems?.first(where: { $0.name == "ticket" })?.value else { throw WorkspaceError.invalid("Use the GitHub account that owns your Ascend workspace.") }
        var request = URLRequest(url: URL(string: origin + "/api/account?mode=native-connection")!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue("native", forHTTPHeaderField: "X-Ascend-Client")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["ticket": ticket, "verifier": verifier])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count < 16000 else { throw WorkspaceError.invalid("Sign-in expired or is not available yet. Start again from this screen.") }
        try await sync.connect(JSONDecoder().decode(SyncConnection.self, from: data)); await sync.sync()
    }
}
