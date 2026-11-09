import { signOut } from "@/auth";

// Route handlers may modify cookies (server components may not). The app
// layout redirects here when a live JWT belongs to a suspended/removed user.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
