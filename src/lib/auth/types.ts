export const USER_ROLES = [
  "participant",
  "architect",
  "coach",
  "sponsor",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const STAGE_KEYS = [
  "profile",
  "persona",
  "validate",
  "diagnostic",
  "mirror",
  "coach",
  "journey",
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGES: Array<{ number: number; key: StageKey; label: string }> = [
  { number: 1, key: "profile", label: "Profile" },
  { number: 2, key: "persona", label: "Persona Discovery" },
  { number: 3, key: "validate", label: "Validate" },
  { number: 4, key: "diagnostic", label: "Growth Diagnostic" },
  { number: 5, key: "mirror", label: "Growth Mirror" },
  { number: 6, key: "coach", label: "Match Coach" },
  { number: 7, key: "journey", label: "Growth Journey" },
];

export const DOC_CATEGORIES = [
  "resume",
  "linkedin_export",
  "biography",
  "assessment_report",
  "career_history",
  "recommendation",
  "work_samples",
  "performance_feedback",
  "personal_notes",
  "other",
] as const;

export type DocumentCategory = (typeof DOC_CATEGORIES)[number];

export const PRIVACY_LEVELS = [
  "private",
  "architect",
  "coach",
  "summary",
  "hidden",
] as const;

export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];
