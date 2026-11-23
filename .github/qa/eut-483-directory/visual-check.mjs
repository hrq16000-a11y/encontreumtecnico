// Chromium UI QA against the current #483 application + local-only Supabase.
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base="http://127.0.0.1:3000";
const user=JSON.parse(readFileSync(join(process.env.RUNNER_TEMP,"eut483-synthetic-owner.json"),"utf8"));
const password="EUT_local_qa_only_483!";
const dest="artifacts/eut-483";
mkdirSync(dest,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={appBase:base,testedAppCode:"09d1342956ff24a57dbade4fbf4bae2ffd81bc9d",
  localClientOverrideOnly:true, widths:[], remoteSupabaseRequests:0, browserPageErrors:[]};
let phase="initial";
try{
  for(const width of [390,1440]){
    phase=String(width)+" startup";
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:"light"});
    const page=await context.newPage();
    page.on("pageerror",e=>report.browserPageErrors.push(String(e).slice(0,300)));
    await page.route("**/*",async route=>{
      let host="";
      try{host=new URL(route.request().url()).hostname}catch{}
      if(host.endsWith(".supabase.co")||host==="pqtzhctvjbfcunmrvxne.supabase.co"){
        report.remoteSupabaseRequests++;await route.abort("blockedbyclient");return;
      }
      await route.continue();
    });
    const checkWidth=async(name)=>{
      const metrics=await page.evaluate(()=>({
        viewport:window.innerWidth,document:document.documentElement.scrollWidth,
        body:document.body.scrollWidth
      }));
      if(metrics.document>width+2||metrics.body>width+2)
        throw Error("Horizontal overflow at "+name+" "+JSON.stringify(metrics));
      return metrics;
    };
    const snap=async(name)=>{
      await page.screenshot({path:join(dest,name),fullPage:true,animations:"disabled"});
    };
    try{
      phase=width+" login";
      await page.goto(base+"/entrar",{waitUntil:"domcontentloaded",timeout:40000});
      await page.getByLabel("E-mail").first().fill(user.email);
      await page.getByLabel("Senha").first().fill(password);
      await page.getByRole("button",{name:"Entrar",exact:true}).first().click();
      await page.waitForTimeout(850);
      phase=width+" admin";
      await page.goto(base+"/admin/tecnicos",{waitUntil:"domcontentloaded",timeout:40000});
      const panel=page.locator('section[aria-label="Configuração de ordenação e destaques"]');
      await panel.getByRole("heading",{name:"Ordenação regional e destaques dos cards"}).waitFor({timeout:22000});
      await panel.locator('input[type="checkbox"]').first().waitFor({timeout:20000});
      if(await panel.locator('input[type="checkbox"]').count()!==8)
        throw Error("Settings UI does not render eight controls");
      await checkWidth("admin");
      if(width===390){
        const cb=panel.locator('input[type="checkbox"]').nth(1); // online_priority
        if(await cb.isChecked())throw Error("Expected ranking disabled after RPC isolated QA");
        await cb.check();
        await panel.locator("textarea").fill("QA de ranking visual e persistencia 390");
        await panel.getByRole("button",{name:"Salvar preferências"}).click();
        await panel.getByText("Preferências gravadas, auditadas e relidas com sucesso.").waitFor({timeout:15000});
        await panel.getByText("Versão 4",{exact:true}).first().waitFor({timeout:10000});
        await page.reload({waitUntil:"domcontentloaded"});
        await page.locator('section[aria-label="Configuração de ordenação e destaques"] input[type="checkbox"]').nth(1).waitFor();
        if(!await page.locator('section[aria-label="Configuração de ordenação e destaques"] input[type="checkbox"]').nth(1).isChecked())
          throw Error("390 reload lost ranking value");
      }else{
        const cb=panel.locator('input[type="checkbox"]').nth(6); // photo_outline
        if(await cb.isChecked())throw Error("Expected card outline disabled after RPC isolated QA");
        await cb.check();
        await panel.locator("textarea").fill("QA visual e persistencia 1440");
        await panel.getByRole("button",{name:"Salvar preferências"}).click();
        await panel.getByText("Preferências gravadas, auditadas e relidas com sucesso.").waitFor({timeout:15000});
        await panel.getByText("Versão 5",{exact:true}).first().waitFor({timeout:10000});
        await page.reload({waitUntil:"domcontentloaded"});
        const outline=page.locator('section[aria-label="Configuração de ordenação e destaques"] input[type="checkbox"]').nth(6);
        await outline.waitFor({timeout:20000});
        if(!await outline.isChecked())throw Error("1440 reload lost card flag");
      }
      await snap("admin-"+width+".png");
      phase=width+" public catalog";
      const url=base+"/tecnicos?cidade="+encodeURIComponent("São José dos Pinhais")+"&uf=PR";
      await page.goto(url,{waitUntil:"domcontentloaded",timeout:40000});
      await page.getByText("Técnico Sintético Curitiba",{exact:false}).first().waitFor({timeout:22000});
      await page.getByText("Técnico Sintético São José",{exact:false}).first().waitFor({timeout:22000});
      await checkWidth("public catalog");
      await page.keyboard.press("Tab");
      const focused=await page.evaluate(()=>document.activeElement?.tagName??"");
      if(!focused||focused==="BODY")throw Error("Keyboard navigation has no active element");
      await snap("tecnicos-"+width+".png");
      report.widths.push({width,admin:"PASS",settingsSaveAndReload:"PASS",
        publicDirectoryWithCoveredCity:"PASS",noOverflow:"PASS",keyboard:"PASS"});
    }catch(e){
      await snap("failure-"+width+".png").catch(()=>{});
      throw e;
    }finally{await context.close();}
  }
  if(report.remoteSupabaseRequests!==0)throw Error("Detected browser requests to hosted Supabase");
  if(report.browserPageErrors.length)throw Error("Critical browser pageerror: "+report.browserPageErrors.slice(0,3));
  report.decision="PASS";
  writeFileSync(join(dest,"visual-evidence.json"),JSON.stringify(report,null,2));
  console.log("PASS Chromium 390/1440: real local GoTrue login, admin settings UI save/reload, public synthetic catalog, keyboard, no overflow, no hosted Supabase.");
}catch(e){
  report.decision="FAIL";report.failedPhase=phase;report.failure=String(e).slice(0,700);
  writeFileSync(join(dest,"visual-evidence.json"),JSON.stringify(report,null,2));
  console.error("FAIL QA483 visual "+phase+": "+String(e));
  process.exitCode=1;
}finally{await browser.close();}
