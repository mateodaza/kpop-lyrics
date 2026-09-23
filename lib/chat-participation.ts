export const CHAT_RULES_VERSION = "2026-09-23";

export function hasCurrentChatParticipation(value: { rulesVersion: string; age16ConfirmedAt: Date | null } | null | undefined): boolean {
  return value?.rulesVersion === CHAT_RULES_VERSION && value.age16ConfirmedAt instanceof Date;
}

export function validatesChatParticipationInput(value: unknown): boolean {
  return !!value && typeof value === "object" &&
    (value as { acceptRules?: unknown }).acceptRules === true &&
    (value as { confirmAge16?: unknown }).confirmAge16 === true;
}
