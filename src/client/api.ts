type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? "Unknown error",
      status: res.status,
    };
  }
  return { ok: true, data: body as T };
}

export type Feed = {
  id: string;
  url: string;
  title: string | null;
  site_url: string | null;
  category: string | null;
  subscribed_at: string;
};

export type EntryItem = {
  id: string;
  feed_id: string;
  url: string | null;
  title: string | null;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  feed_title: string | null;
  is_read: number;
  is_starred: number;
};

export type EntryDetail = EntryItem & {
  content: string | null;
  guid: string;
};

export const api = {
  login(email: string, password: string) {
    return request<{ ok: true }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  logout() {
    return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
  },

  getFeeds() {
    return request<{ feeds: Feed[] }>("/api/feeds");
  },

  addFeed(url: string, category?: string) {
    return request<{ id: string }>("/api/feeds", {
      method: "POST",
      body: JSON.stringify({ url, category }),
    });
  },

  deleteFeed(id: string) {
    return request<{ ok: true }>(`/api/feeds/${id}`, { method: "DELETE" });
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
    return request<{ entries: EntryItem[] }>(
      `/api/entries${qs ? `?${qs}` : ""}`,
    );
  },

  getEntry(id: string) {
    return request<{ entry: EntryDetail }>(`/api/entries/${id}`);
  },

  updateEntryState(
    id: string,
    state: { is_read?: boolean; is_starred?: boolean },
  ) {
    return request<{ ok: true }>(`/api/entries/${id}/state`, {
      method: "PATCH",
      body: JSON.stringify(state),
    });
  },
};
