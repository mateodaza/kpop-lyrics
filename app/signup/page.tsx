import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import SignupPageClient from "./SignupPageClient";
import AuthCutoverMaintenance from "@/components/AuthCutoverMaintenance";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const state = await enterSharedAuthWhenActive();
  if (state === "cutover_freeze")
    return <AuthCutoverMaintenance retryHref="/signup" />;
  return <SignupPageClient />;
}
