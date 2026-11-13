"use client";

// Replaces the root layout when it fails, so it must render <html>/<body> and
// cannot rely on globals.css or shared components.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "40px 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>เกิดข้อผิดพลาด</h1>
        <p>ขออภัย ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p>
        {error.digest ? (
          <p>
            รหัสอ้างอิง: <code>{error.digest}</code>
          </p>
        ) : process.env.NODE_ENV !== "production" ? (
          <p>{error.message}</p>
        ) : null}
        <p>
          <button type="button" onClick={() => reset()} style={{ padding: "8px 16px", marginRight: 8 }}>
            ลองใหม่
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- root layout may be broken; full reload */}
          <a href="/">หน้าแรก</a>
        </p>
      </body>
    </html>
  );
}
