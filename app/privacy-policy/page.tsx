import type { Metadata } from "next";
import LegalDoc from "@/components/LegalDoc";
import { CONTENT } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy | Aegyo Arena",
  description: "How Aegyo Arena collects, uses, and shares information about you.",
};

export default function PrivacyPolicyPage() {
  return <LegalDoc content={`${CONTENT}\n\nFan Chat\nFan chat messages are public and linked to your display name. Posting requires a shared Aegyo account, acceptance of the current Fan Chat Terms, and a self-declaration that you are at least 16. We record the agreement version and time, without collecting your date of birth for chat. We use automated safety screening before publication and allow signed-in members to report messages for human review. Message text is sent to our safety screening provider for classification. Messages leave public chat after 30 days. A daily cleanup deletes ordinary messages after 30 days, held or reported messages after 90 days, and short-lived posting records after one day. Moderators can remove content sooner. Do not post personal contact information in chat.`} />;
}
