import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { technicianInitials, verifiedLegacyAvatarSource } from "@/lib/technician-identity-display";

type Props = {
  name: string;
  originalPhotoUrl?: string | null;
  size?: "card" | "profile";
};

export function TechnicianAvatar({ name, originalPhotoUrl, size = "card" }: Props) {
  const source = verifiedLegacyAvatarSource(originalPhotoUrl);
  const dimensions = size === "profile" ? "h-20 w-20 text-xl" : "h-14 w-14 text-base";

  return (
    <Avatar className={`${dimensions} shrink-0 rounded-2xl border border-primary/15 bg-primary/10 shadow-sm ring-2 ring-background`}>
      {source ? (
        <AvatarImage
          src={source}
          alt={`Foto original verificada de ${name}`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <AvatarFallback
        delayMs={0}
        aria-label={`Avatar com as iniciais de ${name}`}
        className="rounded-2xl bg-primary/10 font-bold tracking-wider text-primary"
      >
        {technicianInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
