export const chatReportReasons = new Set(["abuse", "sexual", "spam", "personal_info", "underage", "other"]);

export function shouldHoldAfterReport(reason: string, currentWindowCount: number): boolean {
  return currentWindowCount >= 2 || reason === "sexual" || reason === "personal_info" || reason === "underage";
}
