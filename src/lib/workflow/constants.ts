import { type PrivacyLevel, type StageKey } from "@/lib/auth/types";

export const REQUIRED_CONSENTS = [
  {
    key: "c1",
    label: "I consent to the use of my information to create my profile.",
    required: true,
  },
  {
    key: "c2",
    label: "I consent to Persona Discovery and Growth Diagnostic processing.",
    required: true,
  },
  {
    key: "c3",
    label: "I consent to AI-assisted analysis subject to my confirmation.",
    required: true,
  },
  {
    key: "c4",
    label: "I consent to sharing approved information with my selected coach.",
    required: false,
  },
] as const;

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  private: "Private to me",
  architect: "Share with Architect",
  coach: "Share with selected coach",
  summary: "Share summary only",
  hidden: "Do not include",
};

type StageGuidanceItem = {
  objective: string;
  checkpoints: string[];
};

export const STAGE_GUIDANCE: Partial<Record<StageKey, StageGuidanceItem>> = {
  persona: {
    objective: "Prepare and capture immersion context with clear themes.",
    checkpoints: [
      "Key questions captured before immersion call",
      "Privacy boundaries discussed and recorded",
      "Architect release decision documented",
    ],
  },
  validate: {
    objective: "Review each insight and confirm what is true, unclear, or needs revision.",
    checkpoints: [
      "Agreement and disagreement points listed",
      "Corrections captured with supporting evidence",
      "Participant sign-off completed",
    ],
  },
  diagnostic: {
    objective: "Complete structured diagnostic responses and publish a usable summary.",
    checkpoints: [
      "Questionnaire completed with no missing core areas",
      "Risk themes and strengths highlighted",
      "Diagnostic release status recorded",
    ],
  },
  mirror: {
    objective: "Finalize Growth Mirror as the active working document.",
    checkpoints: [
      "Identity statement validated",
      "Priority opportunities selected",
      "Mirror accepted and versioned",
    ],
  },
  coach: {
    objective: "Assign the right coach with consented scope and activation intent.",
    checkpoints: [
      "Coach options reviewed by participant",
      "Consent for sharing confirmed",
      "Coach assignment and objective recorded",
    ],
  },
  journey: {
    objective: "Run and track 12-week execution with evidence and review loops.",
    checkpoints: [
      "Weekly commitments captured",
      "Evidence attached and reviewed",
      "Progress and fit reviewed monthly",
    ],
  },
};
