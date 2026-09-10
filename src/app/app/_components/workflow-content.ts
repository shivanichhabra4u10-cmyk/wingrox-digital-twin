export const VALIDATION_INSIGHTS = [
  "One pattern across fields",
  "More than my current role",
  "Relationships, context, curation and delivery",
  "Execution may hide judgment",
  "Built more for other platforms",
  "Dependability can lead to overcommitment",
  "Wider identity with protected security",
  "Hosting or interviews may fit",
  "Portfolio career may fit",
  "Build something in my own name",
  "Creative expression remains part of identity",
  "Family and spirituality shape success",
  "Evidence and method over more learning",
  "Clearer requests from relationships",
  "Test one option before deciding",
] as const;

export const DIAGNOSTIC_SECTIONS = [
  "Present identity and life stage",
  "Aspirations and future self",
  "Passion, purpose and fulfilment",
  "North Star and definition of success",
  "Pain areas and growth gaps",
  "Confidence and opportunity decisions",
  "Recognition, visibility and authority",
  "Boundaries, responsibility and relationships",
  "Energy, resilience and renewal",
  "Focus, action and support",
] as const;

export function diagnosticQuestionTitle(questionNumber: number) {
  const section = DIAGNOSTIC_SECTIONS[Math.floor((questionNumber - 1) / 5)] ?? DIAGNOSTIC_SECTIONS[0];
  return `Q${questionNumber}. ${section}`;
}

export const DIAGNOSTIC_OPTIONS = [
  "This strongly describes me now",
  "This is emerging and needs more evidence",
  "This matters but is not yet structured",
  "This is not a priority right now",
] as const;

export const COACH_OPTIONS = [
  { id: "executive-growth", name: "Executive Growth Activation", fit: "Behaviour change, authority, boundaries and accountable execution." },
  { id: "portfolio-commercial", name: "Portfolio and Commercial Coach", fit: "Offer design, pricing, paid pilots and independent income tests." },
  { id: "voice-presence", name: "Voice and Presence Coach", fit: "Hosting, moderation, interviews and visible communication." },
] as const;
