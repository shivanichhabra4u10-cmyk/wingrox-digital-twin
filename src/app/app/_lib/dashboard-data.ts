import { consumeFlashMessage } from "@/lib/flash";
import { requireProfile } from "@/lib/auth/session";
import { STAGES, type StageKey, type UserRole } from "@/lib/auth/types";

type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
};

export type ParticipantRecord = {
  id: string;
  owner_user_id: string;
  full_name: string;
  email: string | null;
  mobile: string | null;
  country_code: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  current_title: string | null;
  organization: string | null;
  about: string | null;
  help_with: string | null;
  preferred_language: string | null;
  timezone: string | null;
  career_history: string | null;
  education: string | null;
  achievements: string | null;
  interests: string | null;
  family_life_considerations: string | null;
  current_goals: string | null;
  preferred_communication_style: string | null;
  accessibility_needs: string | null;
  created_at: string;
  updated_at: string;
};

export type StageProgressRecord = {
  id: string;
  participant_id: string;
  stage: StageKey;
  is_complete: boolean;
  unlocked: boolean;
  released_by_architect: boolean;
  updated_at: string;
};

export type StagePayloadRecord = {
  stage: StageKey;
  payload: Record<string, unknown> | null;
};

export type ConsentRecord = {
  consent_key: string;
  accepted: boolean;
  accepted_at: string | null;
};

export type DocumentRecord = {
  id: string;
  file_name: string;
  file_size_bytes: number | null;
  category: string;
  privacy: string;
  scan_status: string;
  created_at: string;
};

export type NotificationRecord = {
  id: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export type FlashMessage = Awaited<ReturnType<typeof consumeFlashMessage>>;

export type AppDashboardData = {
  userId: string;
  profile: Profile;
  participants: ParticipantRecord[];
  selectedParticipant: ParticipantRecord | null;
  stageProgress: StageProgressRecord[];
  stagePayloads: StagePayloadRecord[];
  consents: ConsentRecord[];
  documents: DocumentRecord[];
  notifications: NotificationRecord[];
  flash: FlashMessage;
};

const PARTICIPANT_SELECT = [
  "id",
  "owner_user_id",
  "full_name",
  "email",
  "mobile",
  "country_code",
  "city",
  "country",
  "linkedin_url",
  "current_title",
  "organization",
  "about",
  "help_with",
  "preferred_language",
  "timezone",
  "career_history",
  "education",
  "achievements",
  "interests",
  "family_life_considerations",
  "current_goals",
  "preferred_communication_style",
  "accessibility_needs",
  "created_at",
  "updated_at",
].join(", ");

async function ensureParticipantRows(participantId: string, updatedBy: string) {
  const { supabase } = await requireProfile();
  const { data } = await supabase
    .from("stage_progress")
    .select("stage")
    .eq("participant_id", participantId);

  const existing = new Set((data ?? []).map((row) => String(row.stage)));
  const missing = STAGES.filter((stage) => !existing.has(stage.key));

  if (missing.length === 0) return;

  await supabase.from("stage_progress").insert(
    missing.map((stage) => ({
      participant_id: participantId,
      stage: stage.key,
      unlocked: stage.key === "profile",
      is_complete: false,
      released_by_architect: false,
      updated_by: updatedBy,
    }))
  );
}

async function getOrCreateOwnedParticipant() {
  const { supabase, user, profile } = await requireProfile();
  const { data: existing } = await supabase
    .from("participants")
    .select(PARTICIPANT_SELECT)
    .eq("owner_user_id", user.id)
    .maybeSingle<ParticipantRecord>();

  if (existing) {
    await ensureParticipantRows(existing.id, user.id);
    return existing;
  }

  const { data: created, error } = await supabase
    .from("participants")
    .insert({ owner_user_id: user.id, full_name: profile.full_name })
    .select(PARTICIPANT_SELECT)
    .single<ParticipantRecord>();

  if (error || !created) {
    throw new Error(error?.message ?? "Unable to create participant workspace.");
  }

  await ensureParticipantRows(created.id, user.id);
  return created;
}

async function getAccessibleParticipants(role: UserRole) {
  const { supabase, user } = await requireProfile();

  if (role === "participant") {
    return [await getOrCreateOwnedParticipant()];
  }

  if (role === "admin") {
    const { data } = await supabase
      .from("participants")
      .select(PARTICIPANT_SELECT)
      .order("updated_at", { ascending: false })
      .returns<ParticipantRecord[]>();
    return data ?? [];
  }

  const { data: mappings } = await supabase
    .from("user_participant_roles")
    .select("participant_id")
    .eq("user_id", user.id)
    .eq("role", role);

  const ids = [...new Set((mappings ?? []).map((row) => String(row.participant_id)))];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("participants")
    .select(PARTICIPANT_SELECT)
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .returns<ParticipantRecord[]>();

  return data ?? [];
}

export async function getDashboardData(selectedId?: string): Promise<AppDashboardData> {
  const { supabase, user, profile } = await requireProfile();
  const participants = await getAccessibleParticipants(profile.role);
  const selectedParticipant =
    participants.find((participant) => participant.id === selectedId) ?? participants[0] ?? null;

  if (selectedParticipant) {
    await ensureParticipantRows(selectedParticipant.id, user.id);
  }

  const participantId = selectedParticipant?.id;

  const [stageProgress, stagePayloads, consents, documents, notifications, flash] = await Promise.all([
    participantId
      ? supabase
          .from("stage_progress")
          .select("id, participant_id, stage, is_complete, unlocked, released_by_architect, updated_at")
          .eq("participant_id", participantId)
          .order("stage")
          .returns<StageProgressRecord[]>()
      : Promise.resolve({ data: [] as StageProgressRecord[] }),
    participantId
      ? supabase
          .from("stage_payloads")
          .select("stage, payload")
          .eq("participant_id", participantId)
          .returns<StagePayloadRecord[]>()
      : Promise.resolve({ data: [] as StagePayloadRecord[] }),
    participantId
      ? supabase
          .from("consents")
          .select("consent_key, accepted, accepted_at")
          .eq("participant_id", participantId)
          .returns<ConsentRecord[]>()
      : Promise.resolve({ data: [] as ConsentRecord[] }),
    participantId
      ? supabase
          .from("documents")
          .select("id, file_name, file_size_bytes, category, privacy, scan_status, created_at")
          .eq("participant_id", participantId)
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<DocumentRecord[]>()
      : Promise.resolve({ data: [] as DocumentRecord[] }),
    participantId
      ? supabase
          .from("notifications")
          .select("id, message, read_at, created_at")
          .eq("participant_id", participantId)
          .order("created_at", { ascending: false })
          .limit(8)
          .returns<NotificationRecord[]>()
      : Promise.resolve({ data: [] as NotificationRecord[] }),
    consumeFlashMessage(),
  ]);

  return {
    userId: user.id,
    profile,
    participants,
    selectedParticipant,
    stageProgress: stageProgress.data ?? [],
    stagePayloads: stagePayloads.data ?? [],
    consents: consents.data ?? [],
    documents: documents.data ?? [],
    notifications: notifications.data ?? [],
    flash,
  };
}
