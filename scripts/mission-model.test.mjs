import test from 'node:test';
import assert from 'node:assert/strict';
import { missionPhase, missionSummary } from '../dist/mission-model.js';
test('mission progress excludes archives, preserves all task states, and leaves empty phases at zero', () => {
  const tasks = [
    {id:'1', title:'Activate portal', status:'Done', applicationId:'a'},
    {id:'2', title:'CSS Profile receipt', status:'To do', applicationId:'a'},
    {id:'3', title:'Essay revision', status:'In Progress'},
    {id:'4', title:'Volleyball game', status:'Waiting'},
    {id:'5', title:'Old task', status:'Done', archived:true},
  ];
  const original = structuredClone(tasks), result = missionSummary(tasks);
  assert.equal(result.total,4); assert.deepEqual(result.counts,{'To do':1,'In Progress':1,Done:1,Waiting:1});
  assert.equal(result.phases.find(p=>p.id==='applications').percent,100);
  assert.equal(result.phases.find(p=>p.id==='school').percent,0);
  assert.deepEqual(tasks,original);
  assert.equal(missionPhase(tasks[1]),'aid');
  assert.equal(missionPhase({title:'SAT review',applicationId:'a'}),'school');
});
