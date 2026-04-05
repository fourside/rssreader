import { type FormEvent, useState } from "react";
import type { Feed } from "../api";
import styles from "./FeedList.module.css";

type Props = {
  feeds: Feed[];
  selectedFeedId: string | null;
  focused: boolean;
  onSelectFeed: (feedId: string | null) => void;
  onAddFeed: (url: string, category: string) => Promise<boolean>;
  onDeleteFeed: (feedId: string) => void;
};

export function FeedList({
  feeds,
  selectedFeedId,
  focused,
  onSelectFeed,
  onAddFeed,
  onDeleteFeed,
}: Props) {
  const selectedClass = focused
    ? (styles.selectedFocused ?? "")
    : (styles.selected ?? "");
  const [showForm, setShowForm] = useState(false);

  const grouped = new Map<string, Feed[]>();
  const uncategorized: Feed[] = [];

  for (const feed of feeds) {
    if (feed.category) {
      const list = grouped.get(feed.category) ?? [];
      list.push(feed);
      grouped.set(feed.category, list);
    } else {
      uncategorized.push(feed);
    }
  }

  return (
    <div>
      {showForm ? (
        <AddFeedForm
          onSubmit={async (url, category) => {
            const ok = await onAddFeed(url, category);
            if (ok) setShowForm(false);
            return ok;
          }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setShowForm(true)}
        >
          + Add Feed
        </button>
      )}
      <ul className={styles.list}>
        <li
          className={`${styles.allItem} ${selectedFeedId === null ? selectedClass : ""}`}
          onClick={() => onSelectFeed(null)}
          onKeyDown={() => {}}
        >
          <span className={styles.title}>All Feeds</span>
        </li>
        {[...grouped.entries()].map(([category, categoryFeeds]) => (
          <li key={category}>
            <div className={styles.category}>{category}</div>
            <ul className={styles.list}>
              {categoryFeeds.map((feed) => (
                <FeedItem
                  key={feed.id}
                  feed={feed}
                  selected={feed.id === selectedFeedId}
                  selectedClass={selectedClass}
                  onSelect={() => onSelectFeed(feed.id)}
                  onDelete={() => onDeleteFeed(feed.id)}
                />
              ))}
            </ul>
          </li>
        ))}
        {uncategorized.map((feed) => (
          <FeedItem
            key={feed.id}
            feed={feed}
            selected={feed.id === selectedFeedId}
            selectedClass={selectedClass}
            onSelect={() => onSelectFeed(feed.id)}
            onDelete={() => onDeleteFeed(feed.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function AddFeedForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (url: string, category: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    const ok = await onSubmit(url.trim(), category.trim());
    setLoading(false);
    if (!ok) setError("Failed to add feed");
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      {error && <p className={styles.error}>{error}</p>}
      <input
        className={styles.addInput}
        type="url"
        placeholder="Feed URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
      />
      <input
        className={styles.addInput}
        type="text"
        placeholder="Category (optional)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      />
      <div className={styles.addActions}>
        <button type="submit" className={styles.addSubmit} disabled={loading}>
          {loading ? "..." : "Add"}
        </button>
        <button type="button" className={styles.addCancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FeedItem({
  feed,
  selected,
  selectedClass,
  onSelect,
  onDelete,
}: {
  feed: Feed;
  selected: boolean;
  selectedClass: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`${styles.item} ${selected ? selectedClass : ""}`}
      onClick={onSelect}
      onKeyDown={() => {}}
    >
      <span className={styles.title}>{feed.title ?? feed.url}</span>
      <button
        type="button"
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Unsubscribe"
      >
        &times;
      </button>
    </li>
  );
}
