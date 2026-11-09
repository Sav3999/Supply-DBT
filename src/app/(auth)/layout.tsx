export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-center text-xl font-semibold">ระบบยืม-คืนของ</h1>
      {children}
    </main>
  );
}
