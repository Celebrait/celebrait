// openaiErrorHandler.ts
export type OpenAIErrorShape = {
  error?: {
    code?: string | null;
    type?: string | null;
    message?: string | null;
    param?: string | null;
  };
  response?: { status?: number; data?: any };
  status?: number;
  code?: string;
  message?: string;
  name?: string;
};

const SAFETY_CODES = new Set([
  "content_policy_violation", // text/chat safety
  "moderation_blocked",       // gpt-image-1 uploads/edits
  "safety_system"
]);

export function mapOpenAIError(err: unknown) {
  const e = err as OpenAIErrorShape;
  const http = e?.response?.status ?? e?.status;
  const code =
    e?.error?.code ??
    (typeof e?.code === "string" ? e.code : undefined);
  const message =
    e?.error?.message ??
    e?.message ??
    e?.response?.data?.error?.message;

  const looksLikeSafety =
    SAFETY_CODES.has(String(code)) ||
    /safety system|policy|moderation/i.test(String(message));

  if (looksLikeSafety) {
    let userMessage =
      "We couldn't process that because it may violate usage rules. Try rephrasing or removing sensitive details.";
    if (code === "moderation_blocked") {
      userMessage =
        "Your uploaded image or edit request was blocked by our safety system. Try a different image or adjust your request.";
    }
    return {
      kind: "safety" as const,
      http: http ?? 400,
      code: code ?? "content_policy_violation",
      title: "Blocked by Safety System",
      userMessage,
      techMessage: message ?? "Request rejected by safety system.",
    };
  }

  if (http === 401) {
    return {
      kind: "auth" as const,
      http,
      code: code ?? "invalid_api_key",
      title: "Authentication Error",
      userMessage: "The server couldn't authenticate. Check the API key.",
      techMessage: message ?? "Invalid or missing API key.",
    };
  }

  if (http === 429) {
    return {
      kind: "rate" as const,
      http,
      code: code ?? "rate_limit_exceeded",
      title: "Rate Limit",
      userMessage: "We're getting a lot of requests. Please try again shortly.",
      techMessage: message ?? "Rate limit exceeded.",
    };
  }

  if (http && http >= 500) {
    return {
      kind: "server" as const,
      http,
      code: code ?? "server_error",
      title: "Server Error",
      userMessage: "The AI service had a hiccup. Please try again.",
      techMessage: message ?? "OpenAI server error.",
    };
  }

  return {
    kind: "invalid" as const,
    http: http ?? 400,
    code: code ?? "invalid_request_error",
    title: "Invalid Request",
    userMessage: "Something about the request wasn't valid. Please tweak and retry.",
    techMessage: message ?? "Invalid request.",
  };
}

export function showPopup(title: string, body: string) {
  alert(`${title}\n\n${body}`);
}

// Example usage:
// try {
//   const resp = await client.responses.create({ model: "gpt-4.1-mini", input: "Hi" });
// } catch (err) {
//   const mapped = mapOpenAIError(err);
//   showPopup(mapped.title, mapped.userMessage);
//   console.error(mapped.techMessage, err);
// }