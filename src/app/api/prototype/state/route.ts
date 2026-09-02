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

type DiagnosticQuestionnaireRow = {
  id: string;
  participant_id: string;
  bank_name: string | null;
  total_questions: number;
  is_submitted: boolean;
  is_released: boolean;
  report_opened_at: string | null;
};

type DiagnosticQuestionRow = {
  questionnaire_id: string;
  question_id: number;
  display_order: number;
  dimension: string | null;
  question_text: string | null;
  options: unknown;
  scores: unknown;
};

type DiagnosticResponseSnapshotRow = {
  participant_id: string;
  answers: Record<string, unknown> | null;
};

const PROFILE_SELECT = "id, full_name, email, role";

const PARTICIPANT_SELECT = "id, owner_user_id, full_name, email";

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

function extractTimeFromSlot(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const match = value.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i);
  if (!match) {
    return "";
  }

  return match[0].trim();
}

function asBoolean(value: unknown) {
  return value === true;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as number[];
  }

  const out: number[] = [];
  value.forEach((item) => {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(item);
      return;
    }

    if (typeof item === "string" && item.trim()) {
      const parsed = Number(item);
      if (Number.isFinite(parsed)) {
        out.push(parsed);
      }
    }
  });

  return out;
}

function asPositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function asTrimmed(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeChoices(value: unknown) {
  const choices: number[] = [];
  const seen = new Set<number>();

  asArray(value).forEach((entry) => {
    const parsed = asPositiveInt(entry);
    if (!parsed || parsed > 100 || seen.has(parsed)) {
      return;
    }

    seen.add(parsed);
    choices.push(parsed);
  });

  return choices.slice(0, 10);
}

function normalizeScoreList(value: unknown) {
  const out: number[] = [];
  asArray(value).forEach((entry) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out.push(Math.round(entry * 1000) / 1000);
      return;
    }

    if (typeof entry === "string" && entry.trim()) {
      const parsed = Number(entry);
      if (Number.isFinite(parsed)) {
        out.push(Math.round(parsed * 1000) / 1000);
      }
    }
  });

  return out;
}

type DiagnosticQuestionRecord = {
  questionId: number;
  displayOrder: number;
  dimension: string | null;
  questionText: string | null;
  options: string[];
  scores: number[];
  raw: Record<string, unknown>;
};

type NormalizedDiagnostic = {
  bankName: string | null;
  totalQuestions: number;
  isSubmitted: boolean;
  isReleased: boolean;
  reportOpened: boolean;
  answeredCount: number;
  rawDiagnostic: Record<string, unknown>;
  questions: DiagnosticQuestionRecord[];
  answersPayload: Record<string, Record<string, unknown>>;
};

function normalizeDiagnosticState(
  state: Record<string, unknown>
): NormalizedDiagnostic | null {
  const diagnostic = safeObject(state.diagnostic);
  if (!diagnostic) {
    return null;
  }

  const questionBank = asArray(diagnostic.questionBank);
  const answers = safeObject(diagnostic.answers) ?? {};
  const questionMap = new Map<number, DiagnosticQuestionRecord>();
  const questions: DiagnosticQuestionRecord[] = [];

  questionBank.forEach((entry, index) => {
    const row = safeObject(entry);
    if (!row) {
      return;
    }

    const questionId = asPositiveInt(row.id) ?? index + 1;
    if (!questionId || questionMap.has(questionId)) {
      return;
    }

    const options = asArray(row.o)
      .map((option) => asTrimmed(option))
      .filter((option): option is string => Boolean(option));

    const question: DiagnosticQuestionRecord = {
      questionId,
      displayOrder: index + 1,
      dimension: asTrimmed(row.dimension),
      questionText: asTrimmed(row.q),
      options,
      scores: normalizeScoreList(row.scores),
      raw: row,
    };

    questionMap.set(questionId, question);
    questions.push(question);
  });

  const answersPayload: Record<string, Record<string, unknown>> = {};
  let maxAnsweredQuestionId = 0;
  let answeredCount = 0;
  Object.entries(answers).forEach(([answerKey, answerValue]) => {
    const questionId = asPositiveInt(answerKey);
    const answer = safeObject(answerValue);
    if (!questionId || !answer) {
      return;
    }

    const rankedChoices = normalizeChoices(answer.choices);
    const confidence = asTrimmed(answer.conf);
    const comment = asTrimmed(answer.comment);
    const otherText = asTrimmed(answer.other);
    const isPrivate = asBoolean(answer.priv);

    if (questionId > maxAnsweredQuestionId) {
      maxAnsweredQuestionId = questionId;
    }

    if (rankedChoices.length > 0 || confidence || comment || otherText || isPrivate) {
      answeredCount += 1;
    }

    answersPayload[String(questionId)] = {
      choices: rankedChoices,
      conf: confidence ?? "",
      comment: comment ?? "",
      other: otherText ?? "",
      priv: isPrivate,
    };
  });

  const inferredTotal = Math.max(questions.length, maxAnsweredQuestionId, 0);

  return {
    bankName: asTrimmed(diagnostic.questionBankName),
    totalQuestions: inferredTotal,
    isSubmitted: asBoolean(diagnostic.submitted),
    isReleased: asBoolean(diagnostic.released),
    reportOpened: asBoolean(diagnostic.reportOpened),
    answeredCount,
    rawDiagnostic: diagnostic,
    questions,
    answersPayload,
  };
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
  // Diagnostic responses now persist in normalized relational tables.
  // Keep only non-diagnostic workflow payloads in the legacy snapshot.
  const compacted = { ...state };
  const diagnostic = safeObject(compacted.diagnostic);

  if (diagnostic) {
    const copy = { ...diagnostic };
    delete copy.answers;
    delete copy.questionBank;
    compacted.diagnostic = copy;
  }

  return compacted;
}

function stripLegacyDiagnosticPayload(diagnostic: Record<string, unknown> | null) {
  if (!diagnostic) {
    return {};
  }

  const copy = { ...diagnostic };
  delete copy.answers;
  delete copy.questionBank;
  return copy;
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
  documentMap: Map<string, Array<Record<string, unknown>>>,
  diagnosticMap: Map<string, Record<string, unknown>>
) {
  const baseProfile = safeObject(baseState?.profile);
  const baseConsents = safeObject(baseState?.consents);
  const baseDiagnostic = safeObject(baseState?.diagnostic);
  const safeBaseDiagnostic = stripLegacyDiagnosticPayload(baseDiagnostic);
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
    diagnostic: {
      ...safeBaseDiagnostic,
      ...(diagnosticMap.get(participant.id) ?? {}),
    },
    docs: mergedDocs,
  };

  return mergedState;
}

function buildDiagnosticSnapshot(
  questionnaire: DiagnosticQuestionnaireRow | undefined,
  questions: DiagnosticQuestionRow[],
  responseSnapshot?: DiagnosticResponseSnapshotRow
) {
  if (!questionnaire) {
    return {
      submitted: false,
      released: false,
      reportOpened: false,
      questionBankName: "",
      questionBank: null,
      answers: {},
    };
  }

  const questionBank = questions
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => ({
      id: row.question_id,
      dimension: row.dimension,
      q: row.question_text,
      o: asArray(row.options),
      scores: asNumberArray(row.scores),
    }));

  const answers = safeObject(responseSnapshot?.answers) ?? {};

  return {
    submitted: Boolean(questionnaire.is_submitted),
    released: Boolean(questionnaire.is_released),
    reportOpened: Boolean(questionnaire.report_opened_at),
    questionBankName: questionnaire.bank_name ?? "",
    questionBank,
    answers,
  };
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

async function syncDiagnosticResponses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participantId: string,
  userId: string,
  state: Record<string, unknown>
) {
  const nowIso = new Date().toISOString();
  const normalized = normalizeDiagnosticState(state);
  if (!normalized) {
    return;
  }

  const { data: questionnaire, error: questionnaireError } = await supabase
    .from("diagnostic_questionnaires")
    .upsert(
      {
        participant_id: participantId,
        source: "prototype",
        bank_name: normalized.bankName,
        total_questions: normalized.totalQuestions,
        is_submitted: normalized.isSubmitted,
        submitted_at: normalized.isSubmitted ? nowIso : null,
        is_released: normalized.isReleased,
        released_at: normalized.isReleased ? nowIso : null,
        report_opened_at: normalized.reportOpened ? nowIso : null,
        raw_diagnostic: normalized.rawDiagnostic,
        created_by: userId,
        updated_by: userId,
      },
      {
        onConflict: "participant_id,source",
      }
    )
    .select("id")
    .single<{ id: string }>();

  // 42P01 = undefined_table. Keep prototype working if migration is not applied yet.
  if (questionnaireError?.code === "42P01") {
    return;
  }

  if (questionnaireError || !questionnaire) {
    throw new Error(questionnaireError?.message ?? "Unable to save diagnostic questionnaire.");
  }

  const questionnaireId = questionnaire.id;

  if (normalized.questions.length > 0) {
    const { error: deleteQuestionError } = await supabase
      .from("diagnostic_questions")
      .delete()
      .eq("questionnaire_id", questionnaireId);

    if (deleteQuestionError) {
      throw new Error(deleteQuestionError.message);
    }

    const { error: insertQuestionError } = await supabase
      .from("diagnostic_questions")
      .insert(
        normalized.questions.map((question) => ({
          questionnaire_id: questionnaireId,
          question_id: question.questionId,
          display_order: question.displayOrder,
          dimension: question.dimension,
          question_text: question.questionText,
          options: question.options,
          scores: question.scores,
          metadata: question.raw,
        }))
      );

    if (insertQuestionError) {
      throw new Error(insertQuestionError.message);
    }
  }

  const { error: upsertSnapshotError } = await supabase
    .from("diagnostic_response_snapshots")
    .upsert(
      {
        participant_id: participantId,
        answers: normalized.answersPayload,
        answered_count: normalized.answeredCount,
        created_by: userId,
        updated_by: userId,
      },
      {
        onConflict: "participant_id",
      }
    );

  // 42P01 = undefined_table. Keep prototype working if migration is not applied yet.
  if (upsertSnapshotError?.code === "42P01") {
    return;
  }

  if (upsertSnapshotError) {
    throw new Error(upsertSnapshotError.message);
  }
}

async function syncPersonaStage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  participantId: string,
  userId: string,
  state: Record<string, unknown>
) {
  const persona = safeObject(state.persona);
  if (!persona) {
    return;
  }

  const scheduleSource = safeObject(persona.schedule) ?? persona;
  const rawSlot = asString(scheduleSource.slot).trim();
  const rawTime = asString(scheduleSource.time).trim();
  const resolvedTime = rawTime || extractTimeFromSlot(rawSlot) || "";
  const schedule = {
    date: asString(scheduleSource.date).trim(),
    time: resolvedTime,
    tz: asString(scheduleSource.tz).trim() || "UTC",
    mode: asString(scheduleSource.mode).trim() || "Video",
    scheduled: Boolean(scheduleSource.scheduled),
    completed: Boolean(scheduleSource.completed),
    released: Boolean(scheduleSource.released),
    reportOpened: Boolean(scheduleSource.reportOpened),
    notes: asString(scheduleSource.notes).trim(),
    slot: rawSlot || resolvedTime,
  };

  const payload = {
    prepChecklist: safeObject(persona.prepChecklist) ?? {},
    questions: asString(persona.questions).trim(),
    notes: asString(persona.notes).trim(),
    schedule,
    participantNotes: asArray(persona.participantNotes),
    corrections: asArray(persona.corrections),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  const { error } = await supabase.from("stage_payloads").upsert({
    participant_id: participantId,
    stage: "persona",
    payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  const isComplete = Boolean(schedule.completed || persona.completed);
  const isReleased = Boolean(schedule.released || persona.released);
  const isUnlocked = Boolean(schedule.scheduled || persona.scheduled || isComplete || isReleased);

  const { error: progressError } = await supabase
    .from("stage_progress")
    .upsert(
      {
        participant_id: participantId,
        stage: "persona",
        is_complete: isComplete,
        unlocked: isUnlocked,
        released_by_architect: isReleased,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,stage" }
    );

  if (progressError) {
    throw new Error(progressError.message);
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
  await syncDiagnosticResponses(supabase, participantId, userId, state);
  await syncPersonaStage(supabase, participantId, userId, state);
  await syncPrototypeSnapshot(supabase, participantId, userId, state);
}

export async function GET() {
  try {
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
    const diagnosticMap = new Map<string, Record<string, unknown>>();

    if (participantIds.length > 0) {
      const [
        { data: consentRows },
        { data: documentRows },
        { data: questionnaireRows },
        { data: questionRows },
        { data: responseSnapshotRows },
      ] = await Promise.all([
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
        supabase
          .from("diagnostic_questionnaires")
          .select("id, participant_id, bank_name, total_questions, is_submitted, is_released, report_opened_at")
          .in("participant_id", participantIds)
          .eq("source", "prototype"),
        supabase
          .from("diagnostic_questions")
          .select("questionnaire_id, question_id, display_order, dimension, question_text, options, scores"),
        supabase
          .from("diagnostic_response_snapshots")
          .select("participant_id, answers")
          .in("participant_id", participantIds),
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

    const questionnaireByParticipantId = new Map<string, DiagnosticQuestionnaireRow>();
    ((questionnaireRows ?? []) as DiagnosticQuestionnaireRow[]).forEach((row) => {
      questionnaireByParticipantId.set(row.participant_id, row);
    });

    const questionnaireIdSet = new Set(
      Array.from(questionnaireByParticipantId.values()).map((row) => row.id)
    );

    const questionsByQuestionnaireId = new Map<string, DiagnosticQuestionRow[]>();
    ((questionRows ?? []) as DiagnosticQuestionRow[]).forEach((row) => {
      if (!questionnaireIdSet.has(row.questionnaire_id)) {
        return;
      }

      const list = questionsByQuestionnaireId.get(row.questionnaire_id) ?? [];
      list.push(row);
      questionsByQuestionnaireId.set(row.questionnaire_id, list);
    });

    const responseSnapshotByParticipantId = new Map<string, DiagnosticResponseSnapshotRow>();
    ((responseSnapshotRows ?? []) as DiagnosticResponseSnapshotRow[]).forEach((row) => {
      responseSnapshotByParticipantId.set(row.participant_id, row);
    });

    participantIds.forEach((participantId) => {
      const questionnaire = questionnaireByParticipantId.get(participantId);
      if (!questionnaire) {
        return;
      }

      const questions = questionsByQuestionnaireId.get(questionnaire.id) ?? [];
      const responseSnapshot = responseSnapshotByParticipantId.get(participantId);
      const diagnostic = buildDiagnosticSnapshot(questionnaire, questions, responseSnapshot);
      if (diagnostic) {
        diagnosticMap.set(participantId, diagnostic);
      }
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
          documentMap,
          diagnosticMap
        ),
      })),
    });
  } catch (error) {
    console.error("Prototype state load failed", error);
    return NextResponse.json({ error: "Prototype state load failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
  } catch (error) {
    console.error("Prototype state save failed", error);
    return NextResponse.json({ error: "Prototype state save failed." }, { status: 500 });
  }
}