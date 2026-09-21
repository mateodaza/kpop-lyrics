import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import LoginPageClient from "./LoginPageClient";
import AuthCutoverMaintenance from "@/components/AuthCutoverMaintenance";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const state = await enterSharedAuthWhenActive();
  if (state === "cutover_freeze")
    return <AuthCutoverMaintenance retryHref="/login" />;
  return <LoginPageClient />;
}
