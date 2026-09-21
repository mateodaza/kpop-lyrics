import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import ForgotPasswordPageClient from "./ForgotPasswordPageClient";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  await enterSharedAuthWhenActive();
  return <ForgotPasswordPageClient />;
}
