// Shared public tool definitions. Resource preparation also bundles these in the native app.
import {admissionsRequirements} from "./aid-model.js";
const field = (key, label, kind = "text", extra = {}) => ({key, label, kind, ...extra});
const status = (values) => field("status", "Status", "choices", {values});
const notes = field("notes", "Notes", "paragraph");
export const TOOL_DEFINITIONS = [
  {key:"courses", title:"Courses & GPA", symbol:"books.vertical", description:"Keep classes, credit hours, and your self-reported grades together.", fields:[field("teacher","Teacher"),field("schedule","Class schedule"),field("credits","Credits","number",{min:0,max:30}),field("gradePoints","Grade points (0–4)","number",{min:0,max:4}),field("target","Target grade"),notes]},
  {key:"assignments",title:"Assignments",symbol:"pencil.and.list.clipboard",description:"Homework, projects, and exams alongside your college plans.",fields:[field("course","Course"),field("due","Due date","date"),status(["To do","In Progress","Done"]),field("priority","Priority","choices",{values:["High","Medium","Low"]}),field("minutes","Estimated minutes","number",{min:0,max:1440}),notes]},
  {key:"habits",title:"Habits",symbol:"checkmark.circle",description:"Build a daily rhythm with a seven-day check-in and streaks.",fields:[field("category","Category"),field("target","Daily target"),notes]},
  {key:"focusSessions",title:"Focus log",symbol:"timer",description:"Save timed work, subjects, distractions, and what you accomplished.",fields:[field("date","Session date","date"),field("minutes","Minutes focused","number",{min:1,max:1440}),field("subject","Subject / task"),notes]},
  {key:"prompts",title:"Essay prompt bank",symbol:"text.bubble",description:"Track each supplemental prompt, its limit, deadline, and draft stage.",fields:[field("body","Exact prompt","paragraph"),field("limit","Word limit","number",{min:0,max:100000}),field("due","Due date","date"),status(["Not Started","Brainstorming","Drafting","Revising","Complete"]),field("tags","Reusable themes"),notes]},
  {key:"interviewPractice",title:"Interview practice",symbol:"person.wave.2",description:"Prepare concrete stories with the situation, task, action, result method.",fields:[field("question","Practice question","paragraph"),field("situation","Situation","paragraph"),field("task","Task","paragraph"),field("action","Action","paragraph"),field("result","Result & reflection","paragraph"),field("confidence","Confidence (1–5)","number",{min:1,max:5}),field("due","Practice date","date"),notes]},
  {key:"collegeScores",title:"Decision matrix",symbol:"slider.horizontal.3",description:"Compare personal fit ratings. Your ratings are opinions, not admission predictions.",fields:[field("academics","Academic fit (1–5)","number",{min:1,max:5}),field("affordability","Affordability (1–5)","number",{min:1,max:5}),field("campus","Campus fit (1–5)","number",{min:1,max:5}),field("opportunity","Opportunities (1–5)","number",{min:1,max:5}),notes]},
  {key:"weeklyReviews",title:"Weekly reviews",symbol:"calendar.badge.checkmark",description:"Reflect on wins, blockers, and the next three priorities.",fields:[field("date","Week beginning","date"),field("wins","Wins","paragraph"),field("blockers","What got in the way?","paragraph"),field("next","Next three priorities","paragraph"),notes]},
  {key:"receipts",title:"Submission receipts",symbol:"checkmark.seal",description:"Keep confirmation numbers and the dates you verified each submission.",fields:[field("date","Submitted on","date"),field("confirmation","Confirmation / reference"),field("category","Submission type","choices",{values:["Application","Financial aid","Scholarship","Test score","Document","Other"]}),field("url","Official confirmation link"),notes]},
  {key:"readingList",title:"Research library",symbol:"bookmark",description:"Save university research, articles, and financial aid resources with your notes.",fields:[field("url","Source link"),field("tags","Topics / tags"),status(["To read","Reading","Reviewed"]),field("body","Research notes","paragraph"),notes]}
];
export const TOOL_KEYS = TOOL_DEFINITIONS.map(d=>d.key);
export function validateTools(state) {
  for(const d of TOOL_DEFINITIONS) for(const r of state[d.key] || []) {
    if(typeof r.title!=="string") throw Error(`${d.title}: a title is required.`);
    for(const f of d.fields) if(r[f.key]!=null && r[f.key]!=="") {
      if(f.kind==="number") { const value=r[f.key], n=Number(value); if(!['number','string'].includes(typeof value)||!Number.isFinite(n)||n<f.min||n>f.max) throw Error(`${f.label} must be between ${f.min} and ${f.max}.`); }
      else if(typeof r[f.key]!=="string") throw Error(`Invalid ${f.label}.`);
    }
    if(d.key==="habits" && r.doneDates!=null && (!Array.isArray(r.doneDates)||r.doneDates.some(x=>typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!validDay(x))||new Set(r.doneDates).size!==r.doneDates.length)) throw Error("Invalid habit check-in dates.");
  }
}
function validDay(s) { const d=new Date(s+"T12:00:00Z");return !isNaN(d)&&d.toISOString().slice(0,10)===s; }
export function shiftDay(day,amount) {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);}
export function habitStreak(record,day) {const dates=new Set(record.doneDates||[]);let n=0,c=dates.has(day)?day:shiftDay(day,-1);while(dates.has(c)&&n<100000){n++;c=shiftDay(c,-1);}return n;}
export function gpa(courses) {let points=0,credits=0;for(const c of courses.filter(x=>!x.archived)){if(c.gradePoints==null||c.gradePoints===""||!(Number(c.credits)>0))continue;points+=Number(c.gradePoints)*Number(c.credits);credits+=Number(c.credits);}return credits?points/credits:null;}
export function fitScore(r,weights={academics:1,affordability:1,campus:1,opportunity:1}) {let sum=0,total=0;for(const k of ["academics","affordability","campus","opportunity"]){const w=Math.max(0,Number(weights[k])||0);if(r[k]!==""&&r[k]!=null&&Number(r[k])>=1&&Number(r[k])<=5){sum+=Number(r[k])*w;total+=w;}}return total?sum/total:null;}
export function readiness(state) {return state.applications.filter(a=>!a.archived).map(a=>({id:a.id,name:a.name,deadline:a.deadline||"",missing:admissionsRequirements(a).filter(r=>r.required!==false&&!r.exempt&&!r.done),receipts:(state.receipts||[]).filter(r=>!r.archived&&r.applicationId===a.id).length}));}
export const INTERVIEW_QUESTIONS=["Tell me about a time you changed your mind.","Why are you interested in this college?","Describe a challenge and the steps you took.","How have you contributed to a community?","What do you enjoy learning outside class?","Tell me about a collaboration that taught you something.","What questions would you like to ask us?"];
