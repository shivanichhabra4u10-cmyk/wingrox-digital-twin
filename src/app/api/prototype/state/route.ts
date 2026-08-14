import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";

type ProfileRow = {
  id: string;
  full_name: string;
  email?: string | null;
  role: UserRole;
  mobile?: string | null;
  country_code?: string | null;
  city?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  current_title?: string | null;
  organization?: string | null;
  about?: string | null;
  help_with?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  career_history?: string | null;
  education?: string | null;
  achievements?: string | null;
  interests?: string | null;
  family_life_considerations?: string | null;
  current_goals?: string | null;
  preferred_communication_style?: string | null;
  accessibility_needs?: string | null;
};

type ParticipantRow = {
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
};

type PrototypeStateRow = {
  participant_id: string;
  state: Record<string, unknown> | null;
};

type ConsentRow = {
  participant_id: string;
  consent_key: string;
  accepted: boolean;
};

type DocumentRow = {
  participant_id: string;
  id: string;
  file_name: string;
  category: string;
  privacy: string;
};

const PROFILE_SELECT =
  "id, full_name, email, role, mobile, country_code, city, country, linkedin_url, current_title, organization, about, help_with, preferred_language, timezone, career_history, education, achievements, interests, family_life_considerations, current_goals, preferred_communication_style, accessibility_needs";

const PARTICIPANT_SELECT =
  "id, owner_user_id, full_name, email, mobile, country_code, city, country, linkedin_url, current_title, organization, about, help_with, preferred_language, timezone, career_history, education, achievements, interests, family_life_considerations, current_goals, preferred_communication_style, accessibility_needs";

const DOC_CATEGORY_MAP: Record<string, string> = {
  "resume": "resume",
  "résumé": "resume",
  "linkedin export": "linkedin_export",
  "linkedin_export": "linkedin_export",
  "biography": "biography",
  "assessment report": "assessment_report",
  "assessment_report": "assessment_report",
  "career history": "career_history",
  "career_history": "career_history",
  "recommendation": "recommendation",
  "work samples": "work_samples",
  "work_samples": "work_samples",
  "performance feedback": "performance_feedback",
  "performance_feedback": "performance_feedback",
  "personal notes": "personal_notes",
  "personal_notes": "personal_notes",
  "other": "other",
};

const DOC_PRIVACY_MAP: Record<string, string> = {
  "private to me": "private",
  "share with growth sprint architect": "architect",
  "share with selected coach": "coach",
  "share summary only": "summary",
};

function resolveRole(rawRole: unknown): UserRole {
  if (typeof rawRole === "string" && USER_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }

  return "participant";
}

function fallbackFullName(email?: string | null) {
  if (!email) {
    return "User";
  }

  const firstPart = email.split("@")[0]?.trim();
  return firstPart && firstPart.length > 1 ? firstPart : "User";
}

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null };
  }

  let { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    const metadata = user.user_metadata ?? {};
    const fullNameRaw = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
    const fullName = fullNameRaw.length >= 2 ? fullNameRaw : fallbackFullName(user.email);
    const role = resolveRole(metadata.role);

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: fullName,
      role,
    });

    if (!error) {
      const { data: createdProfile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      profile = createdProfile ?? null;
    }
  }

  return { supabase, user, profile };
}

async function ensureParticipantForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fullName: string,
  email?: string | null,
  profile?: ProfileRow | null
) {
  const { data: existing } = await supabase
    .from("participants")
    .select(PARTICIPANT_SELECT)
    .eq("owner_user_id", userId)
    .maybeSingle<ParticipantRow>();

  if (existing) {
    return existing;
  }

  const { data: created, error } = await supabase
    .from("participants")
    .insert({
      owner_user_id: userId,
      full_name: fullName,
      email: email ?? null,
      mobile: profile?.mobile ?? null,
      country_code: profile?.country_code ?? null,
      city: profile?.city ?? null,
      country: profile?.country ?? null,
      linkedin_url: profile?.linkedin_url ?? null,
      current_title: profile?.current_title ?? null,
      organization: profile?.organization ?? null,
      about: profile?.about ?? null,
      help_with: profile?.help_with ?? null,
      preferred_language: profile?.preferred_language ?? null,
      timezone: profile?.timezone ?? null,
      career_history: profile?.career_history ?? null,
      education: profile?.education ?? null,
      achievements: profile?.achievements ?? null,
      interests: profile?.interests ?? null,
      family_life_considerations: profile?.family_life_considerations ?? null,
      current_goals: profile?.current_goals ?? null,
      preferred_communication_style: profile?.preferred_communication_style ?? null,
      accessibility_needs: profile?.accessibility_needs ?? null,
    })
    .select(PARTICIPANT_SELECT)
    .single<ParticipantRow>();

  // 23505 = unique_violation — a concurrent request already created the row.
  if (error?.code === "23505") {
    const { data: race } = await supabase
      .from("participants")
      .select(PARTICIPANT_SELECT)
      .eq("owner_user_id", userId)
      .maybeSingle<ParticipantRow>();
    if (race) return race;
  }

  if (error || !created) {
    throw new Error(error?.message ?? "Unable to create participant.");
  }

  return created;
}

function accountFromParticipant(participant: ParticipantRow) {
  const usernameSource = participant.email || participant.full_name || participant.id;
  const username = usernameSource.split("@")[0]?.trim().toLowerCase() || participant.id;

  return {
    id: `participant-${participant.id}`,
    u: username,
    p: "",
    role: "participant",
    name: participant.full_name,
    pid: participant.id,
    status: "Active",
    created: new Date().toISOString().slice(0, 10),
    lastIn: "",
  };
}

function sessionUsername(email?: string | null) {
  const first = email?.split("@")[0]?.trim().toLowerCase();
  return first || "user";
}

function safeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeDocCategory(value: unknown) {
  const raw = asString(value).trim().toLowerCase();
  return DOC_CATEGORY_MAP[raw] ?? "other";
}

function normalizePrivacy(value: unknown) {
  const raw = asString(value).trim().toLowerCase();
  return DOC_PRIVACY_MAP[raw] ?? "architect";
}

function compactPrototypeState(state: Record<string, unknown>) {
  // Keep full payload to guarantee no workflow fields are lost as UI evolves.
  return { ...state };
}

function profileFromParticipant(participant: ParticipantRow) {
  return {
    fullName: participant.full_name ?? "",
    email: participant.email ?? "",
    mobile: participant.mobile ?? "",
    cc: participant.country_code ?? "+1",
    city: participant.city ?? "",
    country: participant.country ?? "",
    linkedin: participant.linkedin_url ?? "",
    role: participant.current_title ?? "",
    org: participant.organization ?? "",
    about: participant.about ?? "",
    helpWith: participant.help_with ?? "",
    language: participant.preferred_language ?? "",
    tz: participant.timezone ?? "",
    career: participant.career_history ?? "",
    education: participant.education ?? "",
    achievements: participant.achievements ?? "",
    interests: participant.interests ?? "",
    family: participant.family_life_considerations ?? "",
    goals: participant.current_goals ?? "",
    commStyle: participant.preferred_communication_style ?? "",
    access: participant.accessibility_needs ?? "",
  };
}

function profilePatchFromState(state: Record<string, unknown>) {
  const profile = safeObject(state.profile);
  if (!profile) {
    return null;
  }

  return {
    full_name:
      typeof profile.fullName === "string" && profile.fullName.trim()
        ? profile.fullName.trim()
        : undefined,
    email:
      typeof profile.email === "string" && profile.email.trim()
        ? profile.email.trim()
        : null,
    mobile: typeof profile.mobile === "string" ? profile.mobile : null,
    country_code: typeof profile.cc === "string" ? profile.cc : null,
    city: typeof profile.city === "string" ? profile.city : null,
    country: typeof profile.country === "string" ? profile.country : null,
    linkedin_url:
      typeof profile.linkedin === "string" && profile.linkedin.trim()
        ? profile.linkedin.trim()
        : null,
    current_title: typeof profile.role === "string" ? profile.role : null,
    organization: typeof profile.org === "string" ? profile.org : null,
    about: typeof profile.about === "string" ? profile.about : null,
    help_with: typeof profile.helpWith === "string" ? profile.helpWith : null,
    preferred_language: typeof profile.language === "string" ? profile.language : null,
    timezone: typeof profile.tz === "string" ? profile.tz : null,
    career_history: typeof profile.career === "string" ? profile.career : null,
    education: typeof profile.education === "string" ? profile.education : null,
    achievements: typeof profile.achievements === "string" ? profile.achievements : null,
    interests: typeof profile.interests === "string" ? profile.interests : null,
    family_life_considerations: typeof profile.family === "string" ? profile.family : null,
    current_goals: typeof profile.goals === "string" ? profile.goals : null,
    preferred_communication_style:
      typeof profile.commStyle === "string" ? profile.commStyle : null,
    accessibility_needs: typeof profile.access === "string" ? profile.access : null,
  };
}

function restorePrototypeState(
  participant: ParticipantRow,
  baseState: Record<string, unknown> | null,
  consentMap: Map<string, Record<string, boolean>>,
  documentMap: Map<string, Array<Record<string, unknown>>>
) {
  const baseProfile = safeObject(baseState?.profile);
  const baseConsents = safeObject(baseState?.consents);
  const baseDocs = asArray(baseState?.docs).filter((item) => Boolean(safeObject(item))) as Array<Record<string, unknown>>;
  const normalizedDocs = documentMap.get(participant.id) ?? [];
  const docsById = new Map<string, Record<string, unknown>>();

  baseDocs.forEach((doc) => {
    const id = asString(doc.id).trim();
    if (id) {
      docsById.set(id, { ...doc });
    }
  });

  normalizedDocs.forEach((doc) => {
    const id = asString(doc.id).trim();
    if (id) {
      docsById.set(id, { ...(docsById.get(id) ?? {}), ...doc });
    }
  });

  const mergedDocs = docsById.size > 0 ? Array.from(docsById.values()) : baseDocs;

  const mergedState: Record<string, unknown> = {
    ...(baseState ?? {}),
    profile: {
      ...(baseProfile ?? {}),
      ...profileFromParticipant(participant),
    },
    consents: {
      ...(baseConsents ?? {}),
      ...(consentMap.get(participant.id) ?? {}),
    },
    docs: mergedDocs,
  };

  return mergedState;
}

async function syncPrototypeSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participantId: string,
  userId: string,
  state: Record<string, unknown>
) {
  await supabase.from("prototype_states").upsert({
    participant_id: participantId,
    state: compactPrototypeState(state),
    updated_by: userId,
  });
}

async function syncDocumentsMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participantId: string,
  userId: string,
  docs: unknown
) {
  await supabase
    .from("documents")
    .delete()
    .eq("participant_id", participantId)
    .like("storage_path", `prototype/${participantId}/%`);

  const normalized: Array<{
    participant_id: string;
    uploaded_by: string;
    file_name: string;
    storage_bucket: string;
    storage_path: string;
    category: string;
    privacy: string;
    scan_status: string;
    mime_type: string;
    file_size_bytes: null;
  }> = [];

  asArray(docs).forEach((item, index) => {
    const row = safeObject(item);
    if (!row) {
      return;
    }

    const name = asString(row.name).trim();
    if (!name) {
      return;
    }

    const id = asString(row.id).trim() || String(index + 1);
    normalized.push({
      participant_id: participantId,
      uploaded_by: userId,
      file_name: name,
      storage_bucket: "wingrox-docs",
      storage_path: `prototype/${participantId}/${id}`,
      category: normalizeDocCategory(row.cat),
      privacy: normalizePrivacy(row.priv),
      scan_status: "prototype",
      mime_type: "application/x.prototype-metadata",
      file_size_bytes: null,
    });
  });

  if (normalized.length > 0) {
    await supabase.from("documents").insert(normalized);
  }
}

async function syncParticipantCore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participantId: string,
  userId: string,
  state: Record<string, unknown>,
  ownerUserId?: string
) {
  const profilePatch = profilePatchFromState(state);
  if (profilePatch) {
    await supabase
      .from("participants")
      .update(profilePatch)
      .eq("id", participantId);

    if (ownerUserId === userId) {
      await supabase.from("profiles").update(profilePatch).eq("id", userId);
    }
  }

  const consents = safeObject(state.consents);
  if (consents) {
    const consentRows = Object.entries(consents).map(([consentKey, accepted]) => ({
      participant_id: participantId,
      consent_key: consentKey,
      accepted: Boolean(accepted),
      accepted_at: accepted ? new Date().toISOString() : null,
      version: "v1",
    }));

    if (consentRows.length > 0) {
      await supabase.from("consents").upsert(consentRows);
    }
  }

  await syncDocumentsMetadata(supabase, participantId, userId, state.docs);
  await syncPrototypeSnapshot(supabase, participantId, userId, state);
}

export async function GET() {
  const { supabase, user, profile } = await getContext();

  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let visibleParticipants: ParticipantRow[] = [];

  if (profile.role === "participant") {
    const participant = await ensureParticipantForUser(
      supabase,
      user.id,
      profile.full_name,
      user.email,
      profile
    );
    visibleParticipants = [participant];
  } else {
    const { data } = await supabase
      .from("participants")
      .select(PARTICIPANT_SELECT)
      .order("updated_at", { ascending: false })
      .limit(200);

    visibleParticipants = (data ?? []) as ParticipantRow[];
  }

  const participantIds = visibleParticipants.map((participant) => participant.id);
  const snapshotMap = new Map<string, Record<string, unknown> | null>();

  if (participantIds.length > 0) {
    const { data: snapshotRows } = await supabase
      .from("prototype_states")
      .select("participant_id, state")
      .in("participant_id", participantIds);

    ((snapshotRows ?? []) as PrototypeStateRow[]).forEach((row) => {
      snapshotMap.set(row.participant_id, safeObject(row.state));
    });
  }

  const consentMap = new Map<string, Record<string, boolean>>();
  const documentMap = new Map<string, Array<Record<string, unknown>>>();

  if (participantIds.length > 0) {
    const [{ data: consentRows }, { data: documentRows }] = await Promise.all([
      supabase
        .from("consents")
        .select("participant_id, consent_key, accepted")
        .in("participant_id", participantIds),
      supabase
        .from("documents")
        .select("participant_id, id, file_name, category, privacy")
        .in("participant_id", participantIds)
        .like("storage_path", "prototype/%")
        .order("created_at", { ascending: true }),
    ]);

    ((consentRows ?? []) as ConsentRow[]).forEach((row) => {
      const existing = consentMap.get(row.participant_id) ?? {};
      existing[row.consent_key] = Boolean(row.accepted);
      consentMap.set(row.participant_id, existing);
    });

    ((documentRows ?? []) as DocumentRow[]).forEach((row) => {
      const list = documentMap.get(row.participant_id) ?? [];
      list.push({
        id: row.id,
        name: row.file_name,
        cat: row.category,
        priv: row.privacy,
      });
      documentMap.set(row.participant_id, list);
    });
  }

  const selectedPid =
    profile.role === "participant"
      ? visibleParticipants[0]?.id ?? null
      : visibleParticipants[0]?.id ?? null;

  return NextResponse.json({
    session: {
      u: sessionUsername(user.email),
      role: profile.role,
      name: profile.full_name,
      email: user.email ?? null,
      pid: selectedPid,
      aid: user.id,
    },
    adminPid: selectedPid,
    accounts: [
      {
        id: `user-${user.id}`,
        u: sessionUsername(user.email),
        p: "",
        role: profile.role,
        name: profile.full_name,
        pid: selectedPid,
        status: "Active",
        created: new Date().toISOString().slice(0, 10),
        lastIn: "",
      },
      ...visibleParticipants.map(accountFromParticipant),
    ],
    participants: visibleParticipants.map((participant) => ({
      id: participant.id,
      fullName: participant.full_name,
      email: participant.email,
      snapshot: restorePrototypeState(
        participant,
        snapshotMap.get(participant.id) ?? null,
        consentMap,
        documentMap
      ),
    })),
  });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getContext();

  if (!user || !profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const participantsPayload = safeObject(body)?.participants;

  if (!participantsPayload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  let allowedParticipants: ParticipantRow[] = [];

  if (profile.role === "participant") {
    const participant = await ensureParticipantForUser(
      supabase,
      user.id,
      profile.full_name,
      user.email,
      profile
    );
    allowedParticipants = [participant];
  } else {
    const { data } = await supabase
      .from("participants")
      .select(PARTICIPANT_SELECT)
      .order("updated_at", { ascending: false })
      .limit(200);

    allowedParticipants = (data ?? []) as ParticipantRow[];
  }

  const allowedIds = new Set(allowedParticipants.map((participant) => participant.id));
  const ownerByParticipantId = new Map(
    allowedParticipants.map((participant) => [participant.id, participant.owner_user_id])
  );
  const entries = Object.entries(participantsPayload).filter(([participantId, state]) => {
    return allowedIds.has(participantId) && safeObject(state);
  }) as Array<[string, Record<string, unknown>]>;

  for (const [participantId, state] of entries) {
    await syncParticipantCore(
      supabase,
      participantId,
      user.id,
      state,
      ownerByParticipantId.get(participantId)
    );
  }

  return NextResponse.json({ ok: true, saved: entries.length });
}