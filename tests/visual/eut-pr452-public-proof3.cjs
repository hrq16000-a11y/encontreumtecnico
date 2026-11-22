'use strict';
// PR #452 Chromium 390/1440 gate. NEVER query real profiles before a verified
// public source guarantees eligibility + <=3 returns + no private contacts.
// This run is preflight only because active DB definition cannot be attested.
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve('artifacts/eut-pr452-proof3');
fs.mkdirSync(out,{recursive:true});
const expected='3acded06517bda1651551b2a1c097731a60a2bd1';
const projection=fs.readFileSync('docs/sql/eut-signed-technicians-public-catalog-20261117.sql','utf8');
const paidContact=fs.readFileSync('docs/sql/eut-public-eligibility-paid-contact-20261120.sql','utf8');
const projectionLimitSupports3=/_limit\s+integer\s+DEFAULT\s+200/.test(projection) &&
    /LIMIT\s+least\(greatest\(coalesce\(_limit,200\),1\),200\)/i.test(projection);
const noContactFieldsInProjection=/It never returns a phone/.test(projection) &&
    !/['"]phone(_e164|_digits)?['"]\s*,/.test(projection);
const projectionRequiresValidPhone=/c\.phone_e164\s*~\s*'\^\[\+\]55/.test(projection);
const validityInSeparateProposal=/c\.phone_e164\s*~\s*'\^\[\+\]55/.test(paidContact);
// Documented migrations are not evidence of current executable function bodies.
// No authenticated live proof of grants/RLS/function body is available without
// the separately authorized metadata contract verification. Fail closed.
const liveFunctionVerified=false, activeEligibilityVerified=false;
const reasons=[];
if(!projectionLimitSupports3) reasons.push('Server-side 3-record cap not evidenced');
if(!noContactFieldsInProjection) reasons.push('No-private-fields allowlist not evidenced');
if(!projectionRequiresValidPhone) reasons.push('Public admin projection has no valid phone condition');
if(!liveFunctionVerified) reasons.push('Active deployed function body not independently verified');
if(!activeEligibilityVerified) reasons.push('Active complete moderation and paid-contact RLS contract not verified');
const report={
  pr:452,head:expected,status:'NO-GO',
  requestedViewportWidths:[390,1440],
  sourceVerified:false,eligibleRecordsRead:0,networkRequests:0,
  screenshots:[],performedChromium:false,
  projectionLimitSupports3,noContactFieldsInProjection,
  projectionRequiresValidPhone,validityInSeparateProposal,
  activeFunctionVerified:liveFunctionVerified,
  activeEligibilityVerified,
  reasons,
  note:'LIMIT 3 output does not mean 3 physical DB rows scanned. A valid live source remains unproven. No real profile queries or screenshot claims.'
};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'result.txt'),
  'NO-GO PR452. Read 0 records. Network calls 0. Screenshots 0.\n'+
  reasons.map(s=>'- '+s).join('\n')+'\n');
if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,'go=false\n');
console.log('NO-GO: public source contract not verified, no records read.');
for(const r of reasons)console.log('BLOCK:',r);
if(process.argv[2]!=='preflight') {
  console.error('Chromium capture blocked until independently verified active source is available.');
  process.exitCode=78;
}
