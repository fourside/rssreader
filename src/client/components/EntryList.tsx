import { type FormEvent, useEffect, useState } from "react";
import type { EntryItem } from "../api";
import styles from "./EntryList.module.css";

type Props = {
  entries: EntryItem[];
  selectedEntryId: string | null;
  focused: boolean;
  onSelectEntry: (entryId: string) => void;
  feedTitle?: string | undefined;
  searchQuery: string;
  onSearch: (query: string) => void;
};

export function EntryList({
  entries,
  selectedEntryId,
  focused,
  onSelectEntry,
  feedTitle,
  searchQuery,
  onSearch,
}: Props) {
  const selectedClass = focused
    ? (styles.selectedFocused ?? "")
    : (styles.selected ?? "");
  const [input, setInput] = useState(searchQuery);

  useEffect(() => {
    setInput(searchQuery);
  }, [searchQuery]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(input);
  }

  return (
    <div>
      <div className={styles.header}>{feedTitle ?? "All Entries"}</div>
      <form className={styles.searchForm} onSubmit={handleSubmit}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </form>
      {entries.length === 0 ? (
        <p className={styles.empty}>No entries</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={[
                styles.item,
                entry.id === selectedEntryId ? selectedClass : "",
                !entry.is_read ? styles.unread : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectEntry(entry.id)}
              onKeyDown={() => {}}
            >
              <div className={styles.title}>{entry.title ?? "(no title)"}</div>
              <div className={styles.meta}>
                <span>{entry.feed_title}</span>
                {entry.published_at && (
                  <span>
                    {new Date(entry.published_at).toLocaleDateString()}
                  </span>
                )}
                {entry.is_starred ? (
                  <span className={styles.starred}>&#9733;</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
