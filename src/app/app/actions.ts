"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/session";
import { DOC_CATEGORIES, PRIVACY_LEVELS, STAGES } from "@/lib/auth/types";
import { REQUIRED_CONSENTS } from "@/lib/workflow/constants";
import { setFlashMessage } from "@/lib/flash";

const profileSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  mobile: z.string().trim().min(6),
  countryCode: z.string().trim().min(1),
  city: z.string().trim().min(2),
  country: z.string().trim().min(2),
  linkedinUrl: z.string().trim().url().optional().or(z.literal("")),
  currentRole: z.string().trim().min(2),
  organization: z.string().trim().min(2),
  about: z.string().trim().min(20),
  helpWith: z.string().trim().min(20),
  preferredLanguage: z.string().trim().min(2),
  timezone: z.string().trim().min(2),
});

const consentSchema = z.object({
  key: z.enum(REQUIRED_CONSENTS.map((item) => item.key) as [string, ...string[]]),
  accepted: z.enum(["true", "false"]),
});

const docMetaSchema = z.object({
  category: z.enum(DOC_CATEGORIES),
  privacy: z.enum(PRIVACY_LEVELS),
});

const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024;
const STAGE_ENUM = z.enum(STAGES.map((stage) => stage.key) as [string, ...string[]]);

type RoleName = "participant" | "architect" | "coach" | "sponsor" | "admin";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

async function ensureStageProgressRows(participantId: string, updatedBy: string) {
  const { supabase } = await requireProfile();

  const { data: rows } = await supabase
    .from("stage_progress")
    .select("stage")
    .eq("participant_id", participantId);

  const existing = new Set((rows ?? []).map((row) => row.stage));
  const missing = STAGES.filter((stage) => !existing.has(stage.key));

  if (missing.length === 0) {
    return;
  }

  const payload = missing.map((stage) => ({
    participant_id: participantId,
    stage: stage.key,
    unlocked: stage.key === "profile",
    is_complete: false,
    released_by_architect: false,
    updated_by: updatedBy,
  }));

  await supabase.from("stage_progress").insert(payload);
}

async function syncStageUnlocks(participantId: string, updatedBy: string) {
  const { supabase } = await requireProfile();

  const { data: rows } = await supabase
    .from("stage_progress")
    .select("id, stage, is_complete, unlocked, released_by_architect")
    .eq("participant_id", participantId);

  if (!rows || rows.length === 0) {
    return;
  }

  const byStage = new Map(rows.map((row) => [row.stage, row]));

  let previousGateOpen = true;
  for (const stage of STAGES) {
    const row = byStage.get(stage.key);
    if (!row) {
      previousGateOpen = false;
      continue;
    }

    const shouldUnlock = stage.key === "profile" ? true : previousGateOpen;
    if (row.unlocked !== shouldUnlock) {
      await supabase
        .from("stage_progress")
        .update({
          unlocked: shouldUnlock,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }

    previousGateOpen = Boolean(row.is_complete || row.released_by_architect);
  }
}

async function canManageParticipant(
  participantId: string,
  role: RoleName,
  userId: string,
  allowedMappedRoles: RoleName[]
) {
  const { supabase } = await requireProfile();

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
    return role === "participant" || role === "architect";
  }

  const { data: mapped } = await supabase
    .from("user_participant_roles")
    .select("role")
    .eq("participant_id", participantId)
    .eq("user_id", userId);

  const mappedRoles = new Set((mapped ?? []).map((row) => row.role));
  return allowedMappedRoles.some((mappedRole) => mappedRoles.has(mappedRole));
}

async function getOrCreateParticipantId() {
  const { supabase, user, profile } = await requireProfile();

  if (profile.role !== "participant") {
    throw new Error("Only participant users can submit profile data in this version.");
  }

  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existing?.id) {
    await ensureStageProgressRows(existing.id, user.id);
    return { supabase, user, profile, participantId: existing.id };
  }

  const { data: created, error: createError } = await supabase
    .from("participants")
    .insert({
      owner_user_id: user.id,
      full_name: profile.full_name,
    })
    .select("id")
    .single();

  // 23505 = unique_violation — concurrent request already created the row.
  if (createError?.code === "23505") {
    const { data: race } = await supabase
      .from("participants")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (race?.id) {
      await ensureStageProgressRows(race.id, user.id);
      return { supabase, user, profile, participantId: race.id };
    }
  }

  if (createError || !created) {
    throw new Error(createError?.message ?? "Failed to create participant profile.");
  }

  await ensureStageProgressRows(created.id, user.id);

  return { supabase, user, profile, participantId: created.id };
}

async function writeAuditLog(params: {
  actorUserId: string;
  participantId: string;
  action: string;
  entityName: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabase } = await requireProfile();

  await supabase.from("audit_logs").insert({
    actor_user_id: params.actorUserId,
    participant_id: params.participantId,
    action: params.action,
    entity_name: params.entityName,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
}

async function createNotification(params: {
  participantId?: string;
  actorUserId: string;
  targetUserId?: string;
  targetRole?: RoleName;
  message: string;
}) {
  const { supabase } = await requireProfile();

  await supabase.from("notifications").insert({
    participant_id: params.participantId,
    actor_user_id: params.actorUserId,
    target_user_id: params.targetUserId ?? null,
    target_role: params.targetRole ?? null,
    message: params.message,
  });
}

export async function saveProfileAction(formData: FormData) {
  try {
    const parsed = profileSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      mobile: formData.get("mobile"),
      countryCode: formData.get("countryCode"),
      city: formData.get("city"),
      country: formData.get("country"),
      linkedinUrl: formData.get("linkedinUrl"),
      currentRole: formData.get("currentRole"),
      organization: formData.get("organization"),
      about: formData.get("about"),
      helpWith: formData.get("helpWith"),
      preferredLanguage: formData.get("preferredLanguage"),
      timezone: formData.get("timezone"),
    });

    if (!parsed.success) {
      throw new Error("Invalid profile input.");
    }

    const { supabase, user, participantId } = await getOrCreateParticipantId();

    const { error } = await supabase
      .from("participants")
      .update({
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        mobile: parsed.data.mobile,
        country_code: parsed.data.countryCode,
        city: parsed.data.city,
        country: parsed.data.country,
        linkedin_url: parsed.data.linkedinUrl || null,
        current_title: parsed.data.currentRole,
        organization: parsed.data.organization,
        about: parsed.data.about,
        help_with: parsed.data.helpWith,
        preferred_language: parsed.data.preferredLanguage,
        timezone: parsed.data.timezone,
      })
      .eq("id", participantId);

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "profile.updated",
      entityName: "participants",
      entityId: participantId,
    });

    await createNotification({
      participantId,
      actorUserId: user.id,
      targetRole: "architect",
      message: "Participant updated profile details.",
    });

    await setFlashMessage("success", "Profile saved.");
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function setConsentAction(formData: FormData) {
  try {
    const parsed = consentSchema.safeParse({
      key: formData.get("key"),
      accepted: formData.get("accepted"),
    });

    if (!parsed.success) {
      throw new Error("Invalid consent payload.");
    }

    const { supabase, user, participantId } = await getOrCreateParticipantId();
    const isAccepted = parsed.data.accepted === "true";

    const { error } = await supabase.from("consents").upsert({
      participant_id: participantId,
      consent_key: parsed.data.key,
      accepted: isAccepted,
      accepted_at: isAccepted ? new Date().toISOString() : null,
      version: "v1",
    });

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "consent.updated",
      entityName: "consents",
      entityId: parsed.data.key,
      metadata: { accepted: isAccepted },
    });

    await createNotification({
      participantId,
      actorUserId: user.id,
      targetRole: "architect",
      message: `Participant updated consent ${parsed.data.key} to ${isAccepted ? "accepted" : "not accepted"}.`,
    });

    await setFlashMessage("success", "Consent preference updated.");
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function uploadDocumentAction(formData: FormData) {
  try {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Select a document file.");
    }

    if (file.size > MAX_DOC_SIZE_BYTES) {
      throw new Error("File too large. Max size is 10 MB.");
    }

    const parsedMeta = docMetaSchema.safeParse({
      category: formData.get("category"),
      privacy: formData.get("privacy"),
    });

    if (!parsedMeta.success) {
      throw new Error("Invalid document metadata.");
    }

    const { supabase, user, participantId } = await getOrCreateParticipantId();

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "wingrox-docs";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${participantId}/${Date.now()}-${safeName}`;

    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("documents")
      .insert({
        participant_id: participantId,
        uploaded_by: user.id,
        file_name: file.name,
        storage_bucket: bucket,
        storage_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        category: parsedMeta.data.category,
        privacy: parsedMeta.data.privacy,
        scan_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "document.uploaded",
      entityName: "documents",
      entityId: inserted.id,
      metadata: { storagePath, category: parsedMeta.data.category, privacy: parsedMeta.data.privacy },
    });

    await createNotification({
      participantId,
      actorUserId: user.id,
      targetRole: "architect",
      message: `Participant uploaded ${file.name} (${parsedMeta.data.category}).`,
    });

    await setFlashMessage("success", "Document uploaded.");
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function updateDocumentPrivacyAction(formData: FormData) {
  try {
    const id = z.string().uuid().safeParse(formData.get("id"));
    const privacy = z.enum(PRIVACY_LEVELS).safeParse(formData.get("privacy"));

    if (!id.success || !privacy.success) {
      throw new Error("Invalid document update payload.");
    }

    const { supabase, user, participantId } = await getOrCreateParticipantId();

    const { error } = await supabase
      .from("documents")
      .update({ privacy: privacy.data })
      .eq("id", id.data)
      .eq("participant_id", participantId);

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "document.privacy.updated",
      entityName: "documents",
      entityId: id.data,
      metadata: { privacy: privacy.data },
    });

    await setFlashMessage("success", "Document privacy updated.");
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function saveStageNoteAction(formData: FormData) {
  try {
    const parsedStage = STAGE_ENUM.safeParse(formData.get("stage"));
    const parsedNote = z.string().max(4000).safeParse(formData.get("note"));

    if (!parsedStage.success || !parsedNote.success) {
      throw new Error("Invalid stage note payload.");
    }

    const { supabase, user, profile, participantId } = await getOrCreateParticipantId();

    if (profile.role !== "participant") {
      throw new Error("Only participant can write stage notes in this action.");
    }

    const { error } = await supabase.from("stage_payloads").upsert({
      participant_id: participantId,
      stage: parsedStage.data,
      payload: {
        note: parsedNote.data.trim(),
        updatedBy: user.id,
        updatedAt: new Date().toISOString(),
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "stage.note.saved",
      entityName: "stage_payloads",
      entityId: parsedStage.data,
    });

    await createNotification({
      participantId,
      actorUserId: user.id,
      targetRole: "architect",
      message: `Participant saved note for stage ${parsedStage.data}.`,
    });

    await setFlashMessage("success", `Stage ${parsedStage.data} note saved.`);
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function saveArchitectStageNoteAction(formData: FormData) {
  try {
    const participantId = z.string().uuid().safeParse(formData.get("participantId"));
    const stage = STAGE_ENUM.safeParse(formData.get("stage"));
    const note = z.string().max(4000).safeParse(formData.get("note") ?? "");

    if (!participantId.success || !stage.success || !note.success) {
      throw new Error("Invalid architect stage note payload.");
    }

    const { supabase, user, profile } = await requireProfile();

    if (profile.role !== "architect" && profile.role !== "admin") {
      throw new Error("Only architect or admin can save architect notes.");
    }

    const canManage = await canManageParticipant(participantId.data, profile.role, user.id, [
      "architect",
      "admin",
    ]);

    if (!canManage) {
      throw new Error("You do not have permission to manage this participant.");
    }

    const trimmedNote = note.data.trim();
    const { data: existingPayload } = await supabase
      .from("stage_payloads")
      .select("payload")
      .eq("participant_id", participantId.data)
      .eq("stage", stage.data)
      .maybeSingle<{ payload: Record<string, unknown> | null }>();

    const mergedPayload = {
      ...(existingPayload?.payload ?? {}),
      architectNote: trimmedNote,
      architectNoteUpdatedAt: new Date().toISOString(),
      architectNoteUpdatedBy: user.id,
    };

    const { error } = await supabase.from("stage_payloads").upsert({
      participant_id: participantId.data,
      stage: stage.data,
      payload: mergedPayload,
    });

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId: participantId.data,
      action: "stage.architect.note.saved",
      entityName: "stage_payloads",
      entityId: stage.data,
      metadata: { hasNote: trimmedNote.length > 0 },
    });

    await createNotification({
      participantId: participantId.data,
      actorUserId: user.id,
      targetRole: "participant",
      message: `Architect updated guidance note for stage ${stage.data}.`,
    });

    await setFlashMessage("success", `Architect note saved for stage ${stage.data}.`);
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function markParticipantStageCompleteAction(formData: FormData) {
  try {
    const parsedStage = STAGE_ENUM.safeParse(formData.get("stage"));
    const parsedComplete = z.enum(["true", "false"]).safeParse(formData.get("isComplete"));

    if (!parsedStage.success || !parsedComplete.success) {
      throw new Error("Invalid stage completion payload.");
    }

    const { supabase, user, profile, participantId } = await getOrCreateParticipantId();

    if (profile.role !== "participant") {
      throw new Error("Only participant can update own completion.");
    }

    await ensureStageProgressRows(participantId, user.id);

    const isComplete = parsedComplete.data === "true";
    const { error } = await supabase
      .from("stage_progress")
      .update({
        is_complete: isComplete,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("participant_id", participantId)
      .eq("stage", parsedStage.data);

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId,
      action: "stage.complete.updated",
      entityName: "stage_progress",
      entityId: parsedStage.data,
      metadata: { isComplete },
    });

    await createNotification({
      participantId,
      actorUserId: user.id,
      targetRole: "architect",
      message: `Participant marked stage ${parsedStage.data} as ${isComplete ? "complete" : "in progress"}.`,
    });

    await syncStageUnlocks(participantId, user.id);

    await setFlashMessage(
      "success",
      `Stage ${parsedStage.data} marked ${isComplete ? "complete" : "in progress"}.`
    );
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function claimParticipantAction(formData: FormData) {
  try {
    const participantId = z.string().uuid().safeParse(formData.get("participantId"));

    if (!participantId.success) {
      throw new Error("Invalid participant id.");
    }

    const { supabase, user, profile } = await requireProfile();

    if (profile.role !== "architect" && profile.role !== "admin") {
      throw new Error("Only architect or admin can claim participant.");
    }

    const { error } = await supabase.from("user_participant_roles").upsert({
      user_id: user.id,
      participant_id: participantId.data,
      role: "architect",
    });

    if (error) {
      throw new Error(error.message);
    }

    await ensureStageProgressRows(participantId.data, user.id);

    await writeAuditLog({
      actorUserId: user.id,
      participantId: participantId.data,
      action: "participant.claimed",
      entityName: "user_participant_roles",
      metadata: { role: "architect" },
    });

    await createNotification({
      participantId: participantId.data,
      actorUserId: user.id,
      targetRole: "architect",
      message: "Architect has claimed this participant journey.",
    });

    await setFlashMessage("success", "Participant claimed by architect.");
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function assignParticipantByEmailAction(formData: FormData) {
  try {
    const participantId = z.string().uuid().safeParse(formData.get("participantId"));
    const targetEmail = z.string().email().safeParse(formData.get("targetEmail"));
    const role = z.enum(["coach", "sponsor", "architect"]).safeParse(formData.get("role"));

    if (!participantId.success || !targetEmail.success || !role.success) {
      throw new Error("Invalid assignment by email payload.");
    }

    const { supabase, user, profile } = await requireProfile();

    if (profile.role !== "architect" && profile.role !== "admin") {
      throw new Error("Only architect or admin can assign participant roles.");
    }

    const canManage = await canManageParticipant(participantId.data, profile.role, user.id, [
      "architect",
      "admin",
    ]);

    if (!canManage) {
      throw new Error("You do not have permission to assign this participant.");
    }

    const normalizedEmail = targetEmail.data.trim().toLowerCase();
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!targetProfile?.id) {
      throw new Error("No profile found for this email.");
    }

    const { error } = await supabase.from("user_participant_roles").upsert({
      user_id: targetProfile.id,
      participant_id: participantId.data,
      role: role.data,
    });

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId: participantId.data,
      action: "participant.role.assigned.by_email",
      entityName: "user_participant_roles",
      metadata: { targetEmail: normalizedEmail, role: role.data },
    });

    await createNotification({
      participantId: participantId.data,
      actorUserId: user.id,
      targetUserId: targetProfile.id,
      targetRole: role.data,
      message: `You have been assigned as ${role.data} for a participant journey.`,
    });

    await setFlashMessage("success", `Assigned ${normalizedEmail} as ${role.data}.`);
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function assignParticipantRoleAction(formData: FormData) {
  try {
    const participantId = z.string().uuid().safeParse(formData.get("participantId"));
    const targetUserId = z.string().uuid().safeParse(formData.get("targetUserId"));
    const role = z.enum(["coach", "sponsor", "architect"]).safeParse(formData.get("role"));

    if (!participantId.success || !targetUserId.success || !role.success) {
      throw new Error("Invalid assignment payload.");
    }

    const { supabase, user, profile } = await requireProfile();

    if (profile.role !== "architect" && profile.role !== "admin") {
      throw new Error("Only architect or admin can assign participant roles.");
    }

    const canManage = await canManageParticipant(participantId.data, profile.role, user.id, [
      "architect",
      "admin",
    ]);

    if (!canManage) {
      throw new Error("You do not have permission to assign this participant.");
    }

    const { error } = await supabase.from("user_participant_roles").upsert({
      user_id: targetUserId.data,
      participant_id: participantId.data,
      role: role.data,
    });

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId: participantId.data,
      action: "participant.role.assigned",
      entityName: "user_participant_roles",
      metadata: { targetUserId: targetUserId.data, role: role.data },
    });

    await createNotification({
      participantId: participantId.data,
      actorUserId: user.id,
      targetUserId: targetUserId.data,
      targetRole: role.data,
      message: `You have been assigned as ${role.data} for a participant journey.`,
    });

    await setFlashMessage("success", `Role ${role.data} assigned.`);
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function architectUpdateStageAction(formData: FormData) {
  try {
    const participantId = z.string().uuid().safeParse(formData.get("participantId"));
    const stage = STAGE_ENUM.safeParse(formData.get("stage"));
    const isComplete = z.enum(["true", "false"]).safeParse(formData.get("isComplete"));
    const unlocked = z.enum(["true", "false"]).safeParse(formData.get("unlocked"));
    const released = z.enum(["true", "false"]).safeParse(formData.get("released"));

    if (
      !participantId.success ||
      !stage.success ||
      !isComplete.success ||
      !unlocked.success ||
      !released.success
    ) {
      throw new Error("Invalid stage update payload.");
    }

    const { supabase, user, profile } = await requireProfile();

    if (profile.role !== "architect" && profile.role !== "admin") {
      throw new Error("Only architect or admin can update stage release status.");
    }

    const canManage = await canManageParticipant(participantId.data, profile.role, user.id, [
      "architect",
      "admin",
    ]);

    if (!canManage) {
      throw new Error("You do not have permission to manage this participant.");
    }

    await ensureStageProgressRows(participantId.data, user.id);

    const { error } = await supabase
      .from("stage_progress")
      .update({
        is_complete: isComplete.data === "true",
        unlocked: unlocked.data === "true",
        released_by_architect: released.data === "true",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("participant_id", participantId.data)
      .eq("stage", stage.data);

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      actorUserId: user.id,
      participantId: participantId.data,
      action: "stage.architect.updated",
      entityName: "stage_progress",
      entityId: stage.data,
      metadata: {
        isComplete: isComplete.data === "true",
        unlocked: unlocked.data === "true",
        released: released.data === "true",
      },
    });

    await createNotification({
      participantId: participantId.data,
      actorUserId: user.id,
      targetRole: "participant",
      message: `Architect updated stage ${stage.data}: unlocked=${unlocked.data}, released=${released.data}, complete=${isComplete.data}.`,
    });

    await syncStageUnlocks(participantId.data, user.id);

    await setFlashMessage("success", `Stage ${stage.data} state updated.`);
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}

export async function markNotificationReadAction(formData: FormData) {
  try {
    const id = z.string().uuid().safeParse(formData.get("id"));

    if (!id.success) {
      throw new Error("Invalid notification id.");
    }

    const { supabase } = await requireProfile();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id.data);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await setFlashMessage("error", toErrorMessage(error));
  }

  revalidatePath("/app");
}
