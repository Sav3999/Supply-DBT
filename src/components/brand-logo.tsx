import Image from "next/image";

/**
 * DBT logo + site name. The logo file is a JPG on white, so it always sits on
 * a white circular plate (needed on tinted or dark backgrounds).
 */
export function BrandLogo({ size = 36, showName = true }: { size?: number; showName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white"
        style={{ width: size, height: size }}
      >
        <Image src="/brand/dbt-logo.jpg" alt="DBT" width={size} height={size} priority />
      </span>
      {showName && (
        <span className="flex flex-col gap-1 font-heading leading-none whitespace-nowrap">
          <span className="text-base font-bold text-foreground sm:text-lg">ระบบคลังวัสดุ</span>
          <span className="text-xs font-semibold text-primary sm:text-sm">แผนกเทคโนโลยีธุรกิจดิจิทัล</span>
        </span>
      )}
    </span>
  );
}
