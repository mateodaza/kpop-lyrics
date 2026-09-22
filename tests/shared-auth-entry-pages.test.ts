import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pages = [
  ["login", "../app/login/page.tsx", "/login", "LoginPageClient"],
  ["signup", "../app/signup/page.tsx", "/signup", "SignupPageClient"],
  [
    "forgot password",
    "../app/forgot-password/page.tsx",
    "/forgot-password",
    "ForgotPasswordPageClient",
  ],
] as const;

describe("auth entry page cutover UX", () => {
  it.each(pages)(
    "%s renders maintenance before its credential form during freeze",
    (_name, file, retryHref, form) => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).toContain('state === "cutover_freeze"');
      expect(source).toContain(
        `<AuthCutoverMaintenance retryHref="${retryHref}" />`,
      );
      expect(source).toContain(`return <${form} />`);
      expect(source.indexOf("AuthCutoverMaintenance retryHref")).toBeLessThan(
        source.indexOf(`return <${form}`),
      );
    },
  );
});
