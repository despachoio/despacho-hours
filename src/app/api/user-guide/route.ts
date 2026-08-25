import { NextResponse } from "next/server";
import { canonicalRole } from "@/lib/roles";
import { getProfileApiContext } from "@/lib/server/profile-auth";
import { buildUserGuidePayload } from "@/lib/user-guide/guide-data";

export async function GET(request: Request) {
  const context = await getProfileApiContext(request);
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }

  const role = canonicalRole(context.profile.role);
  if (!role) {
    return NextResponse.json({ error: "Unsupported Kairo role" }, { status: 403 });
  }

  const { data: profile } = await context.admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", context.user.id)
    .single();

  return NextResponse.json(
    buildUserGuidePayload({
      name:
        String(profile?.full_name || "").trim() ||
        context.user.email?.split("@")[0] ||
        "Kairo User",
      role,
    }),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
