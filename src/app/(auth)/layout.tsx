import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo size={88} showName={false} />
          <h1 className="text-2xl font-bold">
            ระบบคลังวัสดุ <span className="text-primary">DBT</span>
          </h1>
          <p className="text-sm text-muted-foreground">ระบบยืม-คืนวัสดุและอุปกรณ์ สาขาเทคโนโลยีธุรกิจดิจิทัล</p>
        </div>
        {children}
      </main>
    </div>
  );
}
