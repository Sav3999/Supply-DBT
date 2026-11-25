import { cn } from "@/lib/utils";

/**
 * Item picture in a fixed 4:3 frame. The whole photo is always shown
 * (object-contain on a light background) — never stretched or cropped, so
 * tall, wide and square photos all look right.
 */
export function ItemImage({
  src,
  alt,
  className,
  emptyText = "ไม่มีรูป",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  emptyText?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border bg-brand-surface",
        !src && "border-dashed",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/uploads/${src}`} alt={alt} loading="lazy" className="absolute inset-0 size-full object-contain p-1" />
      ) : (
        <span className="text-sm text-muted-foreground">{emptyText}</span>
      )}
    </div>
  );
}
