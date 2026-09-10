import { REQUIRED_CONSENTS, STAGE_GUIDANCE } from "@/lib/workflow/constants";
import { STAGES, type StageKey } from "@/lib/auth/types";
import type {
  AppDashboardData,
  ConsentRecord,
  ParticipantRecord,
  StagePayloadRecord,
  StageProgressRecord,
} from "../_lib/dashboard-data";

export type StageViewModel = {
  number: number;
  key: StageKey;
  label: string;
  objective: string;
  checkpoints: string[];
  complete: boolean;
  unlocked: boolean;
  released: boolean;
  percent: number;
  note: string;
  architectNote: string;
  updatedAt: string | null;
};

const REQUIRED_PROFILE_FIELDS: Array<keyof ParticipantRecord> = [
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
];

function hasValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function payloadText(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

function stagePercent(progress: StageProgressRecord | undefined, key: StageKey, participant: ParticipantRecord | null, consents: ConsentRecord[]) {
  if (progress?.is_complete) return 100;
  if (key !== "profile") return progress?.released_by_architect ? 80 : progress?.unlocked ? 35 : 0;
  if (!participant) return 0;

  const profileDone = REQUIRED_PROFILE_FIELDS.filter((field) => hasValue(participant[field])).length;
  const consentDone = REQUIRED_CONSENTS.filter((item) => {
    if (!item.required) return true;
    return consents.some((consent) => consent.consent_key === item.key && consent.accepted);
  }).length;
  const total = REQUIRED_PROFILE_FIELDS.length + REQUIRED_CONSENTS.length;
  return Math.round(((profileDone + consentDone) / total) * 100);
}

export function buildStageModels(data: AppDashboardData): StageViewModel[] {
  return STAGES.map((stage) => {
    const progress = data.stageProgress.find((item) => item.stage === stage.key);
    const payload = data.stagePayloads.find((item: StagePayloadRecord) => item.stage === stage.key)?.payload ?? null;
    const guidance = STAGE_GUIDANCE[stage.key];

    return {
      number: stage.number,
      key: stage.key,
      label: stage.label,
      objective: guidance?.objective ?? "Complete the required workspace activity and capture evidence.",
      checkpoints: guidance?.checkpoints ?? ["Required details reviewed", "Notes captured", "Stage status updated"],
      complete: Boolean(progress?.is_complete),
      unlocked: stage.key === "profile" || Boolean(progress?.unlocked),
      released: Boolean(progress?.released_by_architect),
      percent: stagePercent(progress, stage.key, data.selectedParticipant, data.consents),
      note: payloadText(payload, "note"),
      architectNote: payloadText(payload, "architectNote"),
      updatedAt: progress?.updated_at ?? null,
    };
  });
}

export function profileCompleteness(participant: ParticipantRecord | null) {
  if (!participant) return { done: 0, total: REQUIRED_PROFILE_FIELDS.length, percent: 0 };
  const done = REQUIRED_PROFILE_FIELDS.filter((field) => hasValue(participant[field])).length;
  return { done, total: REQUIRED_PROFILE_FIELDS.length, percent: Math.round((done / REQUIRED_PROFILE_FIELDS.length) * 100) };
}

export function overallProgress(stages: StageViewModel[]) {
  if (stages.length === 0) return 0;
  return Math.round(stages.reduce((total, stage) => total + stage.percent, 0) / stages.length);
}
