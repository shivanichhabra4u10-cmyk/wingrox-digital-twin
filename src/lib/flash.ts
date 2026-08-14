import { cookies } from "next/headers";

const FLASH_COOKIE = "wg_flash";

type FlashKind = "success" | "error" | "info";

type FlashMessage = {
  kind: FlashKind;
  text: string;
};

export async function setFlashMessage(kind: FlashKind, text: string) {
  const cookieStore = await cookies();
  const payload: FlashMessage = { kind, text };

  cookieStore.set(FLASH_COOKIE, JSON.stringify(payload), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 20,
  });
}

export async function consumeFlashMessage(): Promise<FlashMessage | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLASH_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  cookieStore.delete(FLASH_COOKIE);

  try {
    const parsed = JSON.parse(raw) as FlashMessage;
    if (!parsed.kind || !parsed.text) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
