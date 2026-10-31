import test from "node:test";
import assert from "node:assert/strict";
import {aidRecords,aidCategory,isAidRequirement,aidIsComplete,cssSubmissionSummary} from "../dist/aid-model.js";
import {applicationChecklist} from "../dist/application-views.js";
import {readiness} from "../dist/workspace-tools-model.js";
import {blankState,calendarEvents} from "../dist/core.js";

test("unfinished aid never reduces admissions completion or readiness",()=>{
  const app={id:"a",requirements:[{id:"r1",title:"Application submitted",done:true},{id:"r2",title:"CSS Profile",done:false},{id:"r3",title:"FAFSA, if eligible",done:false},{id:"r4",title:"Parents' tax return via IDOC",done:false}]};
  const before=structuredClone(app);
  assert.deepEqual(applicationChecklist(app),{total:1,done:1,percent:100,complete:true});
  assert.deepEqual(readiness({applications:[app],receipts:[]})[0].missing,[]);
  assert.deepEqual(app,before);
});
test("admissions financial statements stay in admissions and explicit domains override legacy labels",()=>{
  assert.equal(isAidRequirement({title:"USC financial statement"}),false);
  assert.equal(isAidRequirement({title:"FAFSA information acknowledged",domain:"admissions"}),false);
  assert.equal(isAidRequirement({title:"School funding form",domain:"aid"}),true);
  assert.equal(applicationChecklist({requirements:[{title:"CSS Profile",done:false}]}).complete,false);
});
test("aid tabs include legacy records, avoid migrated duplicates, and keep mixed forms in other aid",()=>{
  const state={aid:[{id:"aid1",title:"CSS Profile",sourceRequirementId:"r1",status:"Submitted"}],applications:[{id:"a",requirements:[{id:"r1",title:"CSS Profile",done:false},{id:"r2",title:"FAFSA",done:true}]}]};
  const before=structuredClone(state);
  assert.equal(aidRecords(state,"CSS Profile").length,1);
  assert.equal(aidRecords(state,"FAFSA")[0].legacy,true);
  assert.equal(aidRecords(state,"FAFSA")[0].status,"Complete");
  assert.equal(aidCategory({title:"Review FAFSA and CSS Profile"}),"Other");
  assert.equal(aidIsComplete(state.aid[0]),false);
  assert.deepEqual(state,before);
});
test("completed admissions leave upcoming reminders while aid keeps its separate destination",()=>{
  const state=blankState();
  state.applications=[{id:"a",name:"Example",status:"Submitted",deadline:"2026-11-01",requirements:[{done:true,title:"Application"},{done:false,title:"CSS Profile"}]}];
  state.aid=[{id:"f",title:"FAFSA",category:"FAFSA",status:"In Progress",due:"2026-11-01"},{id:"c",title:"CSS Profile",status:"In Progress",due:"2026-11-01"}];
  assert.deepEqual(calendarEvents(state).map(e=>e.target),["fafsa","css-profile"]);
});
test("CSS filing statistics distinguish completed submission, duplicate recipients, and school receipts",()=>{
 const state={applications:[],aid:[{id:'filing',category:'CSS Profile',status:'Complete',submissionDate:'2026-10-30'},{id:'one',applicationId:'a',category:'CSS Profile',status:'Complete',submissionDate:'2026-10-30',receiptStatus:'Not verified'},{id:'duplicate',applicationId:'a',category:'CSS Profile',status:'Complete',submissionDate:'2026-10-30',receiptStatus:'Not verified'},{id:'two',applicationId:'b',category:'CSS Profile',status:'Complete',submissionDate:'2026-10-30',receiptStatus:'Received'},{id:'fafsa',category:'FAFSA',status:'In Progress'}]};
 const before=structuredClone(state),summary=cssSubmissionSummary(state);assert.equal(summary.submitted,true);assert.equal(summary.schools.length,2);assert.equal(summary.received,1);assert.equal(summary.date,'2026-10-30');assert.deepEqual(state,before);
 state.aid[0].status='In Progress';assert.equal(cssSubmissionSummary(state).submitted,false);
});
