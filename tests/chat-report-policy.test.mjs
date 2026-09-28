import { test } from "node:test";
import assert from "node:assert/strict";
import { chatReportReasons, shouldHoldAfterReport } from "../lib/chat-report-policy.ts";

test("a single safety report hides possible sexual, personal, or underage exposure pending review", () => {
  for (const reason of ["sexual", "personal_info", "underage"]) {
    assert.equal(chatReportReasons.has(reason), true);
    assert.equal(shouldHoldAfterReport(reason, 1), true);
  }
});

test("ordinary disputes require two independent reports in the current review window", () => {
  for (const reason of ["abuse", "spam", "other"]) {
    assert.equal(shouldHoldAfterReport(reason, 1), false);
    assert.equal(shouldHoldAfterReport(reason, 2), true);
  }
});
