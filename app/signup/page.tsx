import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import SignupPageClient from "./SignupPageClient";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  await enterSharedAuthWhenActive();
  return <SignupPageClient />;
}
