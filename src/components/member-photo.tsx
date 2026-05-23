import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { getMemberPhotoSignedUrl } from "@/lib/photo";

interface Props {
  photoUrl: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackIconClassName?: string;
}

export function MemberPhoto({ photoUrl, alt = "", className, fallbackIconClassName }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSrc(null);
    if (!photoUrl) return;
    getMemberPhotoSignedUrl(photoUrl).then((u) => { if (active) setSrc(u); });
    return () => { active = false; };
  }, [photoUrl]);

  if (src) return <img src={src} alt={alt} className={className} />;
  return (
    <div className={"flex h-full w-full items-center justify-center " + (className ?? "")}>
      <User className={fallbackIconClassName ?? "h-6 w-6 text-muted-foreground"} />
    </div>
  );
}