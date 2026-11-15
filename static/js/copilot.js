/** Module 06: Scientific AI Copilot — grounded in computed metrics, DOIs, and limits. */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatSimpleMarkdown(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

async function optionalGeminiSynthesize(apiKey, question, groundedPayload, lang) {
  const prompt = [
    "You are the TERRA-X Scientific AI Copilot. Rewrite and synthesize ONLY the grounded scientific facts below.",
    "STRICT RULE: Do NOT invent any scores, numbers, DOIs, or claims outside the JSON context provided.",
    `Language: ${lang === "fr" ? "French" : "English"}. Keep it concise (max 110 words).`,
    `User question: ${question}`,
    `Grounded context: ${JSON.stringify({
      answer: groundedPayload.answer,
      citations: groundedPayload.citations,
      limits: groundedPayload.limits,
    })}`,
  ].join("\n\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export function appendCopilotUserMessage(question) {
  const feed = document.getElementById("copilot-feed");
  if (!feed) return;
  const div = document.createElement("div");
  div.className = "msg-user";
  div.innerHTML = escapeHtml(question);
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

export function appendCopilotAiMessage(payload) {
  const feed = document.getElementById("copilot-feed");
  if (!feed) return;
  const div = document.createElement("div");
  div.className = "msg-ai";

  const citesHtml = (payload.citations || [])
    .map(
      (c) => `<a class="cite-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">
        ↗ ${escapeHtml(c.title)} <span style="color:var(--text-muted)">[${escapeHtml(c.doi)}]</span>
      </a>`
    )
    .join("");

  const limitsHtml = (payload.limits || [])
    .map((l) => `<div>• ${escapeHtml(l)}</div>`)
    .join("");

  div.innerHTML = `
    <div class="msg-ai-text">${formatSimpleMarkdown(payload.answer)}</div>
    ${citesHtml ? `<div class="cite-block"><div class="cite-title">Sources &amp; Provenance</div>${citesHtml}</div>` : ""}
    ${limitsHtml ? `<div class="limits-block"><strong>Scientific Limits:</strong>${limitsHtml}</div>` : ""}
  `;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

export async function askCopilot(state, question) {
  appendCopilotUserMessage(question);
  const res = await fetch("/api/copilot/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aoi_id: state.aoiId,
      mission_id: state.missionId,
      weights: state.weights,
      discovery_mode: state.discoveryMode,
      question,
      lang: state.lang,
    }),
  });
  if (!res.ok) return null;
  const payload = await res.json();

  const geminiKey = document.getElementById("gemini-key-input")?.value.trim();
  if (geminiKey) {
    try {
      const enhanced = await optionalGeminiSynthesize(geminiKey, question, payload, state.lang);
      if (enhanced) payload.answer = enhanced;
    } catch {
      // Keep deterministic grounded answer on any API failure
    }
  }

  appendCopilotAiMessage(payload);
  state.copilotHistory.push({ question, answer: payload.answer });
  return payload;
}
