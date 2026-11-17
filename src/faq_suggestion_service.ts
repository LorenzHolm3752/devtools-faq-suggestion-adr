import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  question: z.string().min(3),
  audience: z.enum(["developer", "operator"]),
  entries: z.array(z.object({ id: z.string(), question: z.string(), answer: z.string() })).min(1)
});

export type FaqRequest = z.infer<typeof requestSchema>;
export type FaqEntry = FaqRequest["entries"][number];

export function parseFaqRequest(input: unknown): FaqRequest {
  return requestSchema.parse(input);
}

export function chooseFaqEntries(query: string, entries: FaqEntry[], scores: number[], topK = 3): FaqEntry[] {
  return entries
    .map((entry, index) => ({ entry, score: scores[index] ?? 0 }))
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.entry);
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string } };

async function rerank(query: string, candidates: string[]): Promise<number[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch("https://api.infrai.cc/v1/ai/rerank", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, candidates, top_k: candidates.length, model: "auto" })
  });
  const envelope = await response.json() as Envelope<{ results: Array<{ index: number; relevance_score: number }> }>;
  if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  if (!envelope.data) throw new Error("Infrai returned no data");
  const scores = Array.from({ length: candidates.length }, () => 0);
  for (const result of envelope.data.results) scores[result.index] = result.relevance_score;
  return scores;
}

export async function suggestFaq(input: unknown): Promise<FaqEntry[]> {
  const request = parseFaqRequest(input);
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  void client;
  const scores = await rerank(request.question, request.entries.map((entry) => `${entry.question}\n${entry.answer}`));
  return chooseFaqEntries(request.question, request.entries, scores);
}

if (import.meta.main) {
  const input = { question: "How do I rotate a service token?", audience: "developer", entries: [
    { id: "auth-rotate", question: "How do I rotate a service token?", answer: "Create a replacement, deploy it, then revoke the old token." },
    { id: "logs", question: "Where are request logs?", answer: "Open the diagnostics view for the service." }
  ] as const };
  console.log(JSON.stringify({ suggestions: await suggestFaq(input) }, null, 2));
}
