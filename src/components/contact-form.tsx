import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.from("contact_messages").insert({
      name: f.name.trim(), email: f.email.trim(), subject: f.subject.trim(), message: f.message.trim(),
    });
    if (error) return setState("error");
    setState("ok");
    setF({ name: "", email: "", subject: "", message: "" });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-foreground">Nome
          <input required minLength={2} maxLength={100} className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="text-sm font-medium text-foreground">E-mail
          <input required type="email" maxLength={255} className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </label>
      </div>
      <label className="text-sm font-medium text-foreground">Assunto
        <input required minLength={2} maxLength={150} className={input} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-foreground">Mensagem
        <textarea required minLength={10} maxLength={3000} rows={5} className={input} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      </label>
      <button disabled={state === "sending"} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {state === "sending" ? "Enviando…" : "Enviar mensagem"}
      </button>
      {state === "ok" && <p role="status" className="text-sm text-foreground">Mensagem recebida. Responderemos pelo e-mail informado.</p>}
      {state === "error" && <p role="alert" className="text-sm text-destructive">Não foi possível enviar. Confira os campos e tente novamente.</p>}
    </form>
  );
}
