import test from "node:test";
import assert from "node:assert/strict";
import { chooseFaqEntries, parseFaqRequest } from "./faq_suggestion_service.ts";

test("keeps relevant developer FAQ entries in descending score order", () => {
  const request = parseFaqRequest({
    question: "rotate token",
    audience: "developer",
    entries: [
      { id: "rotate", question: "Rotate a token", answer: "Replace then revoke." },
      { id: "logs", question: "Read logs", answer: "Use diagnostics." },
      { id: "deploy", question: "Deploy", answer: "Ship the release." }
    ]
  });
  const result = chooseFaqEntries(request.question, request.entries, [0.91, 0.2, 0.51]);
  assert.deepEqual(result.map((entry) => entry.id), ["rotate", "deploy"]);
});
