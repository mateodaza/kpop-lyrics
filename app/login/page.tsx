import { enterSharedAuthWhenActive } from "@/lib/shared-auth/entry-page";
import LoginPageClient from "./LoginPageClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await enterSharedAuthWhenActive();
  return <LoginPageClient />;
}
