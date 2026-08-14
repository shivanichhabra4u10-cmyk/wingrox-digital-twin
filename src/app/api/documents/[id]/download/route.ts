import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type UserRole = "participant" | "architect" | "coach" | "sponsor" | "admin";

async function canReadDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: UserRole,
  participantId: string,
  privacy: "private" | "architect" | "coach" | "summary" | "hidden"
) {
  if (role === "admin") {
    return true;
  }

  const { data: participant } = await supabase
    .from("participants")
    .select("owner_user_id")
    .eq("id", participantId)
    .maybeSingle();

  if (!participant) {
    return false;
  }

  if (participant.owner_user_id === userId) {
    return true;
  }

  const { data: mappings } = await supabase
    .from("user_participant_roles")
    .select("role")
    .eq("participant_id", participantId)
    .eq("user_id", userId);

  const mappedRoles = new Set((mappings ?? []).map((row) => row.role));

  if (mappedRoles.has("architect") || mappedRoles.has("admin")) {
    return true;
  }

  if (mappedRoles.has("coach")) {
    return privacy === "coach" || privacy === "summary";
  }

  if (mappedRoles.has("sponsor")) {
    return privacy === "summary";
  }

  return false;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, participant_id, storage_bucket, storage_path, privacy")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const allowed = await canReadDocument(
    supabase,
    user.id,
    profile.role as UserRole,
    doc.participant_id,
    doc.privacy
  );

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: signed, error } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 60 * 5);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Failed to create signed URL" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
