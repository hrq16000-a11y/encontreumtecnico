import { useRef, useState, type ChangeEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { TechnicianAvatar } from "@/components/technician-avatar";

const db = supabase as unknown as SupabaseClient;
const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_INPUT = 12 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Browser-only conversion; no third-party image AI and no original uploaded elsewhere. */
async function preparePhoto(file: File): Promise<{ file: Blob; extension: "webp" | "jpg" | "png" }> {
  if (!ACCEPTED.has(file.type) || file.size > MAX_INPUT) {
    throw new Error("Escolha uma foto JPG, PNG ou WebP de até 12 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Seu navegador não conseguiu processar a foto.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const output = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.78);
    });
    if (output && output.type === "image/webp" && output.size <= MAX_UPLOAD) {
      return { file: output, extension: "webp" };
    }
    if (file.size <= MAX_UPLOAD) {
      return { file, extension: file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg" };
    }
    throw new Error("A foto ficou acima de 2 MB. Escolha uma imagem menor.");
  } finally {
    bitmap.close();
  }
}

export function TechnicianAvatarEditor({
  userId, name, avatarPath, onSaved,
}: {
  userId: string;
  name: string;
  avatarPath: string | null;
  onSaved: (path: string | null) => void;
}) {
  const activeUserId = useRef(userId);
  activeUserId.current = userId;
  const [selected, setSelected] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMessage(""); setAccepted(false);
    if (file && (!ACCEPTED.has(file.type) || file.size > MAX_INPUT)) {
      setSelected(null);
      setMessage("Envie JPG, PNG ou WebP de até 12 MB. A imagem será otimizada para 2 MB.");
    } else setSelected(file);
  }

  async function upload() {
    if (!selected || !accepted || saving) return;
    const owner = userId;
    setSaving(true); setMessage("");
    let path: string | null = null;
    try {
      const image = await preparePhoto(selected);
      if (activeUserId.current !== owner) return;
      path = "avatars/" + owner + "/" + crypto.randomUUID() + "." + image.extension;
      const { error: uploadError } = await supabase.storage.from("eut-technician-avatars")
        .upload(path, image.file, { contentType: image.file.type, upsert: false, cacheControl: "3600" });
      if (uploadError) throw new Error("O envio da foto não foi concluído.");
      if (activeUserId.current !== owner) return;
      const { data, error } = await db.rpc("eut_set_my_technician_avatar", { _path: path });
      if (error || data?.state !== "salvo") throw new Error("A foto não foi associada ao seu perfil.");
      if (activeUserId.current === owner) {
        onSaved(path);
        setSelected(null); setAccepted(false);
        if (avatarPath && avatarPath !== path) {
          const old = await supabase.storage.from("eut-technician-avatars").remove([avatarPath]);
          setMessage(old.error
            ? "Nova foto publicada. Não conseguimos excluir o arquivo anterior; solicite ajuda para removê-lo."
            : "Foto pública salva e associada ao seu perfil.");
        } else setMessage("Foto pública salva e associada ao seu perfil.");
      }
    } catch (error) {
      if (path && activeUserId.current === owner) {
        // Remove an unlinked upload. No other user's objects can be deleted.
        await supabase.storage.from("eut-technician-avatars").remove([path]).catch(() => {});
      }
      if (activeUserId.current === owner) setMessage(error instanceof Error ? error.message : "Falha ao salvar foto.");
    } finally {
      if (activeUserId.current === owner) setSaving(false);
    }
  }

  async function remove() {
    if (saving || !avatarPath) return;
    const owner = userId;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await db.rpc("eut_set_my_technician_avatar", { _path: null });
      if (error || data?.state !== "salvo") throw new Error("Não foi possível ocultar a foto.");
      if (activeUserId.current === owner) {
        onSaved(null);
        const deletion = await supabase.storage.from("eut-technician-avatars").remove([avatarPath]);
        setMessage(deletion.error
          ? "Foto desvinculada do perfil, mas o arquivo antigo ainda pode ser acessado por seu link. Solicite a exclusão ao suporte."
          : "Foto desvinculada e arquivo excluído. Suas iniciais serão exibidas.");
      }
    } catch {
      if (activeUserId.current === owner) setMessage("Falha ao ocultar a foto. Tente novamente.");
    } finally {
      if (activeUserId.current === owner) setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="foto-heading">
      <h2 id="foto-heading" className="text-lg font-bold text-card-foreground">Minha foto de perfil</h2>
      <div className="mt-3 flex items-center gap-4">
        <TechnicianAvatar name={name} avatarPath={avatarPath} className="h-20 w-20" />
        <p className="text-sm text-muted-foreground">
          Use uma foto sua. Sem foto, exibimos suas iniciais — nunca a imagem de outra pessoa.
        </p>
      </div>
      <label htmlFor="eut-avatar-file" className="mt-4 block text-sm font-semibold text-foreground">Escolher foto JPG, PNG ou WebP</label>
      <input id="eut-avatar-file" type="file" accept="image/jpeg,image/png,image/webp"
        onChange={selectFile} disabled={saving}
        className="mt-2 block min-h-11 w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
      {selected && <p className="mt-2 text-xs text-muted-foreground">Selecionada: {selected.name} (otimização automática antes de publicar).</p>}
      <label className="mt-4 flex items-start gap-3 rounded-lg border border-border p-3 text-sm text-foreground">
        <input type="checkbox" checked={accepted} disabled={saving}
          onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
        <span>Confirmo que a foto é minha e autorizo sua exibição pública no cadastro.
          A imagem poderá ser vista e compartilhada por qualquer visitante.</span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={!selected || !accepted || saving}
          onClick={() => void upload()}
          className="min-h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar minha foto"}
        </button>
        {avatarPath && <button type="button" disabled={saving} onClick={() => void remove()}
          className="min-h-12 rounded-xl border border-input bg-background px-5 text-sm font-semibold text-foreground">
          Ocultar foto pública
        </button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Fotos antigas do WordPress só serão reutilizadas após confirmação de titularidade e mídia original.
        Não importamos imagens por semelhança de nome ou telefone.
      </p>
      {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
    </section>
  );
}
