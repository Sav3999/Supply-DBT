import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/server/auth/session";
import { getLineClient } from "@/server/line/client";
import { LineSection, PasswordForm, ProfileForm } from "./profile-forms";

export default async function ProfilePage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });

  const lineEnabled = getLineClient().enabled;
  const addFriendUrl = getEnv().LINE_OA_ADD_FRIEND_URL;
  const qrDataUrl = lineEnabled && addFriendUrl ? await QRCode.toDataURL(addFriendUrl, { margin: 1 }) : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">โปรไฟล์</h1>
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <ProfileForm user={{ name: user.name, department: user.department, phone: user.phone }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      {lineEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>LINE</CardTitle>
          </CardHeader>
          <CardContent>
            <LineSection linked={!!user.lineUserId} qrDataUrl={qrDataUrl} addFriendUrl={addFriendUrl} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
