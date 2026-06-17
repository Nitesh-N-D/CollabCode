import type { StudentState } from "@collabcode/shared";

interface CacheEntry {
  hint: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function fallbackHint(student: StudentState): string {
  if (!student.content.trim()) {
    return "Write the smallest input-output example first, then express that example as one executable step.";
  }
  if (student.errorCount > 0) {
    return "Read the first error only. What value and type does that exact line receive immediately before it fails?";
  }
  if (student.content.includes("pass") || student.content.includes("TODO")) {
    return "Replace one placeholder with the base case. What is the simplest input whose answer you already know?";
  }
  return "State the invariant in plain language, then check which current line is the first one that breaks it.";
}

async function geminiHint(student: StudentState): Promise<string | undefined> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return undefined;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Give one Socratic coding hint under 30 words. Do not provide the solution.
Language: ${student.languageId}
File: ${student.fileName}
Code:
${student.content.slice(0, 4000)}`
              }
            ]
          }
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 80 }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

export async function generateHint(
  student: StudentState
): Promise<{ hint: string; cached: boolean }> {
  const fingerprint = `${student.studentId}:${student.content}:${student.errorCount}`;
  const existing = cache.get(fingerprint);
  if (existing && existing.expiresAt > Date.now()) {
    return { hint: existing.hint, cached: true };
  }
  let hint = fallbackHint(student);
  try {
    hint = (await geminiHint(student)) || hint;
  } catch (error) {
    console.warn("[AI] Provider unavailable, using local Socratic fallback:", error);
  }
  cache.set(fingerprint, { hint, expiresAt: Date.now() + 60_000 });
  return { hint, cached: false };
}
