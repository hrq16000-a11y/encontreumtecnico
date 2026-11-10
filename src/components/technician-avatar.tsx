import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_BUCKET = "eut-technician-avatars";
const SAFE_PATH = /^avatars\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;

export function publicTechnicianAvatarUrl(path: string | null | undefined): string | null {
  if (!path || !SAFE_PATH.test(path)) return null;
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function technicianInitials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length > 1) return ((parts[0]?.[0] ?? "?") + (parts.at(-1)?.[0] ?? "?")).toLocaleUpperCase("pt-BR");
  return (parts[0] || "?").slice(0, 2).toLocaleUpperCase("pt-BR");
}

/** Fallback is identity-neutral initials, never a borrowed or random portrait. */
export function TechnicianAvatar({
  name, avatarPath, className = "h-14 w-14", loading = "lazy",
}: {
  name: string;
  avatarPath: string | null | undefined;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const url = useMemo(() => publicTechnicianAvatarUrl(avatarPath), [avatarPath]);
  return <Avatar aria-label={"Foto ou iniciais de " + name}
    className={"shrink-0 border border-primary/20 bg-gradient-to-br from-primary/25 to-accent text-primary shadow-sm " + className}>
    {url && <AvatarImage src={url} alt={"Foto pública de " + name} loading={loading}
      className="h-full w-full object-cover" />}
    <AvatarFallback delayMs={150} className="bg-transparent text-lg font-extrabold text-primary">
      {technicianInitials(name)}
    </AvatarFallback>
  </Avatar>;
}
