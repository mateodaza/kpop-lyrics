import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import ForgotPasswordPageClient from "./ForgotPasswordPageClient";
import AuthCutoverMaintenance from "@/components/AuthCutoverMaintenance";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const state = await enterSharedAuthWhenActive();
  if (state === "cutover_freeze")
    return <AuthCutoverMaintenance retryHref="/forgot-password" />;
  return <ForgotPasswordPageClient />;
}
