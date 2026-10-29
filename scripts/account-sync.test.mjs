import test from 'node:test';
import assert from 'node:assert/strict';
import {accountSyncDecision} from '../dist/account-sync-model.js';
test('a fresh browser restores the existing cloud workspace automatically',()=>{assert.equal(accountSyncDecision('blank','cloud',undefined,true),'pull');assert.equal(accountSyncDecision('same','same',undefined,true),'same');});
test('an existing local workspace is never replaced automatically without a baseline',()=>{assert.equal(accountSyncDecision('local','cloud',undefined,false),'conflict');assert.equal(accountSyncDecision('changed','cloud','baseline',true),'conflict');});
test('account devices keep existing conflict protection for offline edits',()=>{assert.equal(accountSyncDecision('baseline','changed','baseline'),'pull');assert.equal(accountSyncDecision('changed','baseline','baseline'),'push');assert.equal(accountSyncDecision('one','two','baseline'),'conflict');});
