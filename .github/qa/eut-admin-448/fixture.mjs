// Isolated PR #448 visual fixture. All app data is synthetic and all services are loopback.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, ".github/qa/eut-admin-448/.runtime");
const localProject = path.join(root, ".github/qa/eut-operations-368");
const raw = execFileSync("supabase", ["status", "-o", "env"], {
  cwd: localProject, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
const values = Object.fromEntries(raw.split(/\r?\n/).filter(line => line.includes("=")).map(line => {
  const index = line.indexOf("=");
  return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
}));
const api = values.API_URL;
const db = new URL(values.DB_URL || "http://invalid.invalid");
if (api !== "http://127.0.0.1:54321" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "54322" || !values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
  throw Error("GO/NO-GO: local Auth/DB isolation could not be proven");
}
const identity = randomUUID();
const email = "eut-qa448-" + identity.slice(0, 8) + "@example.invalid";
const password = "QA448-Only-" + randomUUID() + "!";
const provision = await fetch(api + "/auth/v1/admin/users", {
  method: "POST",
  headers: {
    apikey: values.SERVICE_ROLE_KEY,
    authorization: "Bearer " + values.SERVICE_ROLE_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({ email, password, email_confirm: true }),
  signal: AbortSignal.timeout(15000),
});
const admin = await provision.json();
if (![200, 201].includes(provision.status) || !admin.id) {
  throw Error("Local GoTrue failed to create the synthetic admin");
}
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "session.json"), JSON.stringify({
  api, anon: values.ANON_KEY, id: admin.id, email, password,
}), { mode: 0o600 });

const fakeRows = [
  { id: admin.id, full_name: "Administrador Sintético", roles: "admin", is_admin: true,
    is_client: false, is_technician: false, blocked_account: false, blocked_phone: false },
  ...Array.from({ length: 22 }, (_, i) => ({
    id: "b0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    full_name: "Cliente Sintético " + String(i + 1).padStart(2, "0"),
    roles: "cliente", is_admin: false, is_client: true, is_technician: false,
    blocked_account: i === 4, blocked_phone: i === 7,
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: "c0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
    full_name: "Técnico Sintético " + String(i + 1),
    roles: "tecnico", is_admin: false, is_client: false, is_technician: true,
    blocked_account: false, blocked_phone: false,
  })),
].map((row, i) => ({
  ...row, masked_email: "s•••" + i + "@example.invalid",
  masked_phone: "(41) *****-" + String(1000 + i),
  email_confirmed: true,
  technician_id: row.is_technician ? row.id : null,
  technician_status: row.is_technician ? "habilitado" : null,
  created_at: "2026-11-10T12:00:00Z",
}));
const fakeFile = path.join(dir, "supabase-fixture.ts");
writeFileSync(fakeFile, [
  "const rows = " + JSON.stringify(fakeRows) + ";",
  "const admin = " + JSON.stringify({ id: admin.id, full_name: "Administrador Sintético" }) + ";",
  "export const supabase = {",
  "  from(table) { return { select(_cols, opts) { return {",
  "    eq(field, value) { return {",
  "      then(resolve, reject) { return Promise.resolve({ data: table === 'user_roles' && field === 'user_id' && value === admin.id ? [{role:'admin'}] : [], error:null }).then(resolve,reject); },",
  "      order() { return { range() { return Promise.resolve({data: table === 'user_roles' ? [{user_id:admin.id,created_at:'2026-11-10'}] : [],count:1,error:null}); } }; }",
  "    }; },",
  "    in(field, ids) { return Promise.resolve({ data: table === 'profiles' && ids.includes(admin.id) ? [admin] : [], error:null }); }",
  "  }; } }; },",
  "  async rpc(name, args) {",
  "    if (name !== 'eut_admin_accounts_snapshot') { globalThis.__qa448WriteAttempts = (globalThis.__qa448WriteAttempts||0)+1; throw Error('Synthetic fixture forbids mutations'); }",
  "    const search = String(args._search||'').toLowerCase();",
  "    const filter = String(args._filter||'todos');",
  "    const page = Math.max(0, Number(args._page)||0);",
  "    const matching = rows.filter(row => (filter === 'todos' || (filter === 'clientes' && row.is_client) || (filter === 'tecnicos' && row.is_technician) || (filter === 'bloqueados' && row.blocked_account) || (filter === 'sem_papel' && !row.roles)) && (!search || row.full_name.toLowerCase().includes(search) || row.id.toLowerCase().includes(search)));",
  "    return {data:{ accounts:matching.slice(page*20,page*20+20),total:matching.length,page,page_size:20,blocked_phones:[],audit:[] },error:null};",
  "  }",
  "};",
].join("\n"));

const entry = [
  "import React from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {createRootRoute,createRoute,createRouter,createMemoryHistory,Outlet,RouterProvider} from '@tanstack/react-router';",
  "import {AdminUsersHub} from '@/components/admin-users-hub';",
  "import '@/styles.css';",
  "const adminId = " + JSON.stringify(admin.id) + ";",
  "const anon = " + JSON.stringify(values.ANON_KEY) + ";",
  "const root = createRootRoute({component:()=>React.createElement(Outlet)});",
  "const section = createRoute({getParentRoute:()=>root,path:'/admin/$secao',component:()=>React.createElement('main',{className:'mx-auto max-w-screen-2xl p-3 sm:p-6'},React.createElement(AdminUsersHub,{adminOwnerId:adminId}))});",
  "const router = createRouter({routeTree:root.addChildren([section]),history:createMemoryHistory({initialEntries:['/admin/usuarios']})});",
  "async function start(){",
  " const token=window.__QA448_TOKEN__;",
  " if(typeof token!=='string'||!token) throw Error('Missing local GoTrue token');",
  " const result=await fetch('/auth/v1/user',{headers:{apikey:anon,authorization:'Bearer '+token}});",
  " if(!result.ok) throw Error('Local GoTrue rejected session');",
  " const user=await result.json();",
  " if(user.id!==adminId) throw Error('Unexpected identity in QA');",
  " document.getElementById('status').textContent='Autenticado com GoTrue local · dados sintéticos';",
  " createRoot(document.getElementById('app')).render(React.createElement(RouterProvider,{router}));",
  "}",
  "start().catch(e=>{document.getElementById('status').textContent='GO/NO-GO: auth local indisponível';console.error('QA448 local auth failure', e.message);});",
].join("\n");
writeFileSync(path.join(dir, "entry.tsx"), entry);
writeFileSync(path.join(dir, "index.html"),
  '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>EUT QA448 sintético</title></head><body><div id="status" role="status">Validando sessão local…</div><div id="app"></div><script type="module" src="./entry.tsx"></script></body></html>');
const server = await createServer({
  configFile: false,
  root,
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: /^@\/integrations\/supabase\/client$/, replacement: fakeFile },
    { find: /^@\//, replacement: path.join(root, "src") + "/" },
  ] },
  server: {
    host: "127.0.0.1", port: 4188, strictPort: true,
    proxy: { "/auth/v1": { target: api, changeOrigin: true } },
    fs: { strict: true, allow: [root] },
  },
});
await server.listen();
console.log("QA448_LOCAL_FIXTURE_READY 127.0.0.1:4188");
process.on("SIGTERM", async () => { await server.close(); process.exit(0); });
