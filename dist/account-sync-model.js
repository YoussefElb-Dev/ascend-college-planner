import {syncDecision} from './sync-core.js';
export function accountSyncDecision(localHash,remoteHash,baseline,freshDevice=false){
 if(localHash===remoteHash)return 'same';
 if(freshDevice&&!baseline)return 'pull';
 return syncDecision(localHash,remoteHash,baseline);
}
