import Foundation
import CryptoKit

public enum SyncCrypto {
    public static let aad = Data("ascend-sync-v1".utf8)
    public static func newKey() -> String { SymmetricKey(size: .bits256).withUnsafeBytes { Data($0).base64EncodedString() } }
    private static func key(_ raw: String) throws -> SymmetricKey { guard let data = Data(base64Encoded:raw), data.count == 32 else { throw WorkspaceError.invalid("Import the original 32-byte sync key from your first device.") }; return SymmetricKey(data:data) }
    public static func seal(_ workspace: Workspace, key raw: String) throws -> Data {
        let pack: [String: JSONValue] = ["workspace":.object(workspace.root),"modifiedAt":.string(ISO8601DateFormatter().string(from:Date()))]
        let plain = try JSONEncoder().encode(pack)
        let box = try AES.GCM.seal(plain,using:key(raw),authenticating:aad)
        guard let data=box.combined else { throw WorkspaceError.invalid("Encryption failed.") }
        return try JSONEncoder().encode(["format":"ascend.encrypted.v1","data":data.base64EncodedString()])
    }
    public static func open(_ data: Data, key raw: String) throws -> Workspace {
        guard data.count <= 24*1024*1024 else { throw WorkspaceError.invalid("Sync file exceeds the safety limit.") }
        do {
            let envelope=try JSONDecoder().decode([String:String].self,from:data)
            guard envelope["format"]=="ascend.encrypted.v1",let combined=Data(base64Encoded:envelope["data"] ?? "") else { throw WorkspaceError.invalid("Invalid encrypted file.") }
            let plain=try AES.GCM.open(AES.GCM.SealedBox(combined:combined),using:key(raw),authenticating:aad)
            let pack=try JSONDecoder().decode([String:JSONValue].self,from:plain)
            guard case .object?=pack["workspace"] else { throw WorkspaceError.invalid("Invalid workspace payload.") }
            return try Workspace.decode(JSONEncoder().encode(pack["workspace"]!))
        } catch { throw WorkspaceError.invalid("The sync file could not be opened. Use your original connection/key. Local records are preserved.") }
    }
    public static func fingerprint(_ w: Workspace) throws -> String { Data(SHA256.hash(data:try w.encoded())).base64EncodedString() }
    public static func decision(local:String,remote:String,baseline:String?) -> String { if local==remote{return "same"};guard let baseline else{return "conflict"};if local==baseline{return "pull"};if remote==baseline{return "push"};return "conflict" }
}
