import { useCallback, useEffect, useState } from "react";
import { api, type EntryDetail, type EntryItem, type Feed } from "./api";
import { EntryList } from "./components/EntryList";
import { EntryView } from "./components/EntryView";
import { FeedList } from "./components/FeedList";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";

type AuthState = "loading" | "unauthenticated" | "authenticated";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryDetail, setEntryDetail] = useState<EntryDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.getFeeds().then((result) => {
      setAuthState(result.ok ? "authenticated" : "unauthenticated");
      if (result.ok) setFeeds(result.data.feeds);
    });
  }, []);

  const loadEntries = useCallback(async (feedId: string | null) => {
    const result = await api.getEntries(
      feedId ? { feed_id: feedId } : undefined,
    );
    if (result.ok) setEntries(result.data.entries);
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    if (searchQuery) return;
    loadEntries(selectedFeedId);
    setSelectedEntryId(null);
    setEntryDetail(null);
  }, [authState, selectedFeedId, loadEntries, searchQuery]);

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      loadEntries(selectedFeedId);
      return;
    }
    const result = await api.search(query);
    if (result.ok) {
      setEntries(result.data.entries);
      setSelectedEntryId(null);
      setEntryDetail(null);
    }
  }

  async function handleSelectEntry(entryId: string) {
    setSelectedEntryId(entryId);
    const result = await api.getEntry(entryId);
    if (result.ok) {
      setEntryDetail(result.data.entry);
      if (!result.data.entry.is_read) {
        await api.updateEntryState(entryId, { is_read: true });
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, is_read: 1 } : e)),
        );
        setEntryDetail((prev) => (prev ? { ...prev, is_read: 1 } : prev));
      }
    }
  }

  async function handleToggleField(field: "is_read" | "is_starred") {
    if (!entryDetail) return;
    const newValue = entryDetail[field] ? 0 : 1;
    await api.updateEntryState(entryDetail.id, { [field]: !!newValue });
    setEntryDetail((prev) => (prev ? { ...prev, [field]: newValue } : prev));
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryDetail.id ? { ...e, [field]: newValue } : e,
      ),
    );
  }

  async function handleLogout() {
    await api.logout();
    setAuthState("unauthenticated");
  }

  if (authState === "loading") return null;
  if (authState === "unauthenticated") {
    return (
      <LoginPage
        onLogin={() => {
          setAuthState("authenticated");
        }}
      />
    );
  }

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId);

  return (
    <Layout
      feedList={
        <FeedList
          feeds={feeds}
          selectedFeedId={selectedFeedId}
          onSelectFeed={(id) => {
            setSelectedFeedId(id);
            setSearchQuery("");
          }}
        />
      }
      entryList={
        <EntryList
          entries={entries}
          selectedEntryId={selectedEntryId}
          onSelectEntry={handleSelectEntry}
          feedTitle={
            searchQuery
              ? `Search: ${searchQuery}`
              : (selectedFeed?.title ?? undefined)
          }
          searchQuery={searchQuery}
          onSearch={handleSearch}
        />
      }
      entryView={
        <EntryView
          key={entryDetail?.id}
          entry={entryDetail}
          onToggleRead={() => handleToggleField("is_read")}
          onToggleStar={() => handleToggleField("is_starred")}
        />
      }
      onLogout={handleLogout}
    />
  );
}
