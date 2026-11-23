import { ZodError } from "zod";
import { ActionSchema, CreateOpp, HttpError, PatchOpp, createOpportunity, dashboard, getBundle, importCsv, importSeedCsv, listInstitutions, listOpportunities, promoteInstitution, resetDemo, runAction, runAnalysis, updateOpportunity } from "./store";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Fired in this tab after every successful write so every view refreshes at once. */
export const DATA_EVENT = "pilot-engine:changed";

type Body = Record<string, unknown> | undefined;

/**
 * In-browser replacement for the REST API. The UI calls api("/api/…") exactly as it would call a
 * server; this router runs the same store functions against localStorage instead.
 */
function route(method: string, path: string, body: Body): unknown {
  const seg = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const b = body ?? {};
  if (seg[0] === "dashboard" && method === "GET") return dashboard();
  if (seg[0] === "demo" && method === "POST") return resetDemo();
  if (seg[0] === "opportunities") {
    const id = seg[1];
    if (!id) return method === "GET" ? { opportunities: listOpportunities() } : { opportunity: createOpportunity(CreateOpp.parse(b)) };
    if (seg[2] === "analyze") return runAnalysis(id, String(b.actor ?? ""));
    if (seg[2] === "actions") return runAction(id, ActionSchema.parse(b));
    return method === "PATCH" ? updateOpportunity(id, PatchOpp.parse(b)) : getBundle(id);
  }
  if (seg[0] === "pipeline") {
    if (seg[1] === "promote") return promoteInstitution(String(b.institutionId ?? ""), String(b.actor ?? ""));
    if (method === "GET") return { institutions: listInstitutions() };
    return { institutions: b.seed ? importSeedCsv() : importCsv(String(b.fileName ?? ""), String(b.text ?? "")) };
  }
  throw new HttpError(404, "Unknown request.");
}

export async function api<T>(url: string, body?: unknown, method?: string): Promise<T> {
  const m = method ?? (body === undefined ? "GET" : "POST");
  // A short pause on writes so pending states are visible, as they would be against a server.
  if (m !== "GET") await new Promise((r) => setTimeout(r, 140));
  try {
    const out = route(m, url, body as Body) as T;
    if (m !== "GET" && typeof window !== "undefined") window.dispatchEvent(new Event(DATA_EVENT));
    return out;
  } catch (e) {
    if (e instanceof HttpError) throw new ApiError(e.message, e.status);
    if (e instanceof ZodError) throw new ApiError(e.issues[0]?.message || "That request was not valid.", 400);
    console.error(e);
    throw new ApiError("Something went wrong. Nothing was saved.", 500);
  }
}
