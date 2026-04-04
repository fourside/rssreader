import * as v from "valibot";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

const ErrorSchema = v.object({ error: v.optional(v.string()) });

async function request<T>(
  path: string,
  schema: v.GenericSchema<T>,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const parsed = v.safeParse(ErrorSchema, json);
    const error = parsed.success
      ? (parsed.output.error ?? "Unknown error")
      : "Unknown error";
    return { ok: false, error, status: res.status };
  }
  const parsed = v.parse(schema, json);
  return { ok: true, data: parsed };
}

const FeedSchema = v.object({
  id: v.string(),
  url: v.string(),
  title: v.nullable(v.string()),
  site_url: v.nullable(v.string()),
  category: v.nullable(v.string()),
  subscribed_at: v.string(),
});

export type Feed = v.InferOutput<typeof FeedSchema>;

const EntryItemSchema = v.object({
  id: v.string(),
  feed_id: v.string(),
  url: v.nullable(v.string()),
  title: v.nullable(v.string()),
  summary: v.nullable(v.string()),
  author: v.nullable(v.string()),
  published_at: v.nullable(v.string()),
  feed_title: v.nullable(v.string()),
  is_read: v.number(),
  is_starred: v.number(),
});

export type EntryItem = v.InferOutput<typeof EntryItemSchema>;

const EntryDetailSchema = v.object({
  ...EntryItemSchema.entries,
  content: v.nullable(v.string()),
  guid: v.string(),
});

export type EntryDetail = v.InferOutput<typeof EntryDetailSchema>;

const OkSchema = v.object({ ok: v.literal(true) });
const IdSchema = v.object({ id: v.string() });
const FeedsSchema = v.object({ feeds: v.array(FeedSchema) });
const EntriesSchema = v.object({ entries: v.array(EntryItemSchema) });
const EntrySchema = v.object({ entry: EntryDetailSchema });

export const api = {
  login(email: string, password: string) {
    return request("/api/auth/login", OkSchema, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request("/api/auth/logout", OkSchema, { method: "POST" });
  },

  getFeeds() {
    return request("/api/feeds", FeedsSchema);
  },

  addFeed(url: string, category?: string) {
    return request("/api/feeds", IdSchema, {
      method: "POST",
      body: JSON.stringify({ url, category }),
    });
  },

  deleteFeed(id: string) {
    return request(`/api/feeds/${id}`, OkSchema, { method: "DELETE" });
  },

  getEntries(params?: {
    feed_id?: string;
    starred?: boolean;
    unread?: boolean;
  }) {
    const search = new URLSearchParams();
    if (params?.feed_id) search.set("feed_id", params.feed_id);
    if (params?.starred) search.set("starred", "true");
    if (params?.unread) search.set("unread", "true");
    const qs = search.toString();
    return request(`/api/entries${qs ? `?${qs}` : ""}`, EntriesSchema);
  },

  getEntry(id: string) {
    return request(`/api/entries/${id}`, EntrySchema);
  },

  updateEntryState(
    id: string,
    state: { is_read?: boolean; is_starred?: boolean },
  ) {
    return request(`/api/entries/${id}/state`, OkSchema, {
      method: "PATCH",
      body: JSON.stringify(state),
    });
  },
};
