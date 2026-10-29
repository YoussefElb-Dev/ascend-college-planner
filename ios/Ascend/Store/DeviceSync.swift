import Foundation
import Security
import SwiftUI

struct SyncConnection: Codable {
    var format="ascend-sync-connection-v1"
    var owner: String
    var repo: String
    var token: String
    var key: String
    var baseline: String?
    var sha: String?
    var lastSync: String?
    func validate() throws {
        guard owner.range(of:"^[-a-zA-Z0-9_]+$",options:.regularExpression) != nil, repo.range(of:"^[-a-zA-Z0-9_.]+$",options:.regularExpression) != nil,repo != ".",repo != "..",!token.isEmpty,Data(base64Encoded:key)?.count==32 else { throw WorkspaceError.invalid("Enter a valid repository, token, and original sync key.") }
    }
    var portable: Self { var c=self;c.baseline=nil;c.sha=nil;c.lastSync=nil;return c }
}

enum SyncKeychain {
    static let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"com.youssefelb.ascend.sync",kSecAttrAccount as String:"private-github"]
    static func read() throws -> SyncConnection? {
        var q=query;q[kSecReturnData as String]=true;q[kSecMatchLimit as String]=kSecMatchLimitOne;var result: CFTypeRef?
        let code=SecItemCopyMatching(q as CFDictionary,&result);if code==errSecItemNotFound{return nil};guard code==errSecSuccess,let data=result as? Data else {throw WorkspaceError.invalid("The saved sync connection is unavailable in Keychain.")};return try JSONDecoder().decode(SyncConnection.self,from:data)
    }
    static func write(_ c: SyncConnection) throws {
        let data=try JSONEncoder().encode(c),attributes:[String:Any]=[kSecValueData as String:data,kSecAttrAccessible as String:kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let code=SecItemUpdate(query as CFDictionary,attributes as CFDictionary)
        if code==errSecItemNotFound {var q=query;attributes.forEach{q[$0.key]=$0.value};guard SecItemAdd(q as CFDictionary,nil)==errSecSuccess else {throw WorkspaceError.invalid("The connection could not be saved securely.")}}
        else if code != errSecSuccess {throw WorkspaceError.invalid("The connection could not be updated securely.")}
    }
    static func remove() throws {let code=SecItemDelete(query as CFDictionary);guard code==errSecSuccess||code==errSecItemNotFound else {throw WorkspaceError.invalid("Could not remove the Keychain connection.")}}
}

struct RemoteWorkspace { var workspace: Workspace; var sha: String }
struct SyncConflict { var remote: RemoteWorkspace; var localHash: String }

@MainActor final class DeviceSyncStore: ObservableObject {
    @Published private(set) var connection: SyncConnection?
    @Published private(set) var status="Not connected"
    @Published private(set) var busy=false
    @Published private(set) var conflict: SyncConflict?
    private weak var store: WorkspaceStore?
    private var debounce: Task<Void,Never>?
    private var applying=false
    var active=true
    init() { do {connection=try SyncKeychain.read();if connection != nil {status="Ready to sync"}} catch {status=error.localizedDescription} }
    func attach(_ value: WorkspaceStore) {store=value}
    func changed() {guard !applying else{return};debounce?.cancel();debounce=Task {try? await Task.sleep(nanoseconds:15_000_000_000);guard !Task.isCancelled,self.conflict==nil else{return};await self.sync()}}
    func connect(_ c: SyncConnection) async throws {guard !busy else{throw WorkspaceError.invalid("Wait for the current sync to finish.")};try c.validate();try await verify(c);try SyncKeychain.write(c.portable);connection=c.portable;conflict=nil;status="Connected. Choose Sync now."}
    func disconnect() throws {guard !busy else{throw WorkspaceError.invalid("Wait for the current sync to finish.")};try SyncKeychain.remove();connection=nil;conflict=nil;status="Disconnected. Local records and the encrypted cloud file remain."}
    func sync(force: String?=nil) async {
        guard !busy,active,var c=connection,let store,!store.preview,!store.recoveryRequired else{return}
        busy=true;status="Checking encrypted cloud file…";defer{busy=false}
        do {
            try await verify(c)
            let local=store.workspace,localHash=try SyncCrypto.fingerprint(local)
            if let remote=try await read(c) {
                let remoteHash=try SyncCrypto.fingerprint(remote.workspace)
                if force != nil, let prior=conflict, prior.remote.sha != remote.sha || prior.localHash != localHash {conflict=SyncConflict(remote:remote,localHash:localHash);status="A copy changed after review. Review both versions again.";return}
                let fresh = !FileManager.default.fileExists(atPath: store.file.path)
                let decision=force ?? (fresh && c.baseline == nil ? "pull" : SyncCrypto.decision(local:localHash,remote:remoteHash,baseline:c.baseline))
                if decision=="conflict" {conflict=SyncConflict(remote:remote,localHash:localHash);status="Both copies have changes. Review them below.";return}
                if decision=="pull" {
                    guard try SyncCrypto.fingerprint(store.workspace)==localHash else{status="New local edits detected. Sync again.";return}
                    applying=true;defer{applying=false};try store.replace(with:remote.workspace);c.baseline=remoteHash;c.sha=remote.sha
                } else if decision=="push" {c.sha=try await write(c,workspace:local,sha:remote.sha);c.baseline=localHash}
                else {c.baseline=localHash;c.sha=remote.sha}
            } else {c.sha=try await write(c,workspace:local,sha:nil);c.baseline=localHash}
            c.lastSync=ISO8601DateFormatter().string(from:Date());try SyncKeychain.write(c);connection=c;conflict=nil;status="Up to date"
        } catch {status=error.localizedDescription}
    }
    private func request(_ c: SyncConnection,_ path: String,method: String="GET",body: Data?=nil,raw: Bool=false) async throws -> (Data,Int) {
        try c.validate()
        let base="https://api.github.com/repos/\(c.owner)/\(c.repo)"
        guard let url=URL(string:base+path),url.host=="api.github.com" else{throw WorkspaceError.invalid("Invalid sync destination.")}
        var request=URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:30);request.httpMethod=method;request.httpBody=body
        request.setValue("Bearer "+c.token,forHTTPHeaderField:"Authorization");request.setValue(raw ? "application/vnd.github.raw+json":"application/vnd.github+json",forHTTPHeaderField:"Accept");request.setValue("2022-11-28",forHTTPHeaderField:"X-GitHub-Api-Version");request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        let (data,response)=try await URLSession.shared.data(for:request);let status=(response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status)||status==404 else {throw WorkspaceError.invalid(status==409||status==422 ? "The cloud file changed. Sync again and review both copies.":status==401||status==403 ? "GitHub rejected the token. Check expiry and Contents read/write permission.":"GitHub sync failed (\(status)). Local data is preserved.")}
        guard data.count<=24*1024*1024 else{throw WorkspaceError.invalid("Sync file is too large.")};return(data,status)
    }
    private func verify(_ c: SyncConnection) async throws {let (data,status)=try await request(c,"");guard status != 404,let r=try JSONSerialization.jsonObject(with:data) as? [String:Any],r["private"] as? Bool==true else{throw WorkspaceError.invalid("Choose a private repository accessible to this token.")}}
    private func read(_ c: SyncConnection) async throws -> RemoteWorkspace? {
        let (data,status)=try await request(c,"/contents/workspace.enc.json");if status==404{return nil}
        guard let record=try JSONSerialization.jsonObject(with:data) as? [String:Any],let sha=record["sha"] as? String,(record["size"] as? Int ?? 0)<=24*1024*1024 else{throw WorkspaceError.invalid("Invalid cloud file metadata.")}
        let encrypted: Data
        if record["encoding"] as? String=="base64",let text=record["content"] as? String,let decoded=Data(base64Encoded:text,options:.ignoreUnknownCharacters){encrypted=decoded}
        else {let (raw,status)=try await request(c,"/contents/workspace.enc.json",raw:true);guard status != 404 else{throw WorkspaceError.invalid("Cloud file changed while reading. Sync again.")};encrypted=raw}
        return RemoteWorkspace(workspace:try SyncCrypto.open(encrypted,key:c.key),sha:sha)
    }
    private func write(_ c: SyncConnection,workspace: Workspace,sha: String?) async throws -> String {
        var payload:[String:Any]=["message":"Update encrypted Ascend workspace","content":try SyncCrypto.seal(workspace,key:c.key).base64EncodedString()];if let sha{payload["sha"]=sha}
        let (data,status)=try await request(c,"/contents/workspace.enc.json",method:"PUT",body:JSONSerialization.data(withJSONObject:payload))
        guard status != 404,let result=try JSONSerialization.jsonObject(with:data) as? [String:Any],let content=result["content"] as? [String:Any],let sha=content["sha"] as? String else{throw WorkspaceError.invalid("The cloud file could not be saved. Check Contents write permission.")};return sha
    }
}
