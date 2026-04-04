import type { EntryItem } from "../api";
import styles from "./EntryList.module.css";

type Props = {
  entries: EntryItem[];
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
  feedTitle?: string;
};

export function EntryList({
  entries,
  selectedEntryId,
  onSelectEntry,
  feedTitle,
}: Props) {
  return (
    <div>
      <div className={styles.header}>{feedTitle ?? "All Entries"}</div>
      {entries.length === 0 ? (
        <p className={styles.empty}>No entries</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={[
                styles.item,
                entry.id === selectedEntryId ? styles.selected : "",
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
