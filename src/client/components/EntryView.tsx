import DOMPurify from "dompurify";
import type { EntryDetail } from "../api";
import styles from "./EntryView.module.css";

type Props = {
  entry: EntryDetail | null;
  onToggleRead: () => void;
  onToggleStar: () => void;
};

export function EntryView({ entry, onToggleRead, onToggleStar }: Props) {
  if (!entry) {
    return <div className={styles.empty}>Select an entry to read</div>;
  }

  return (
    <article>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {entry.url ? (
            <a href={entry.url} target="_blank" rel="noopener noreferrer">
              {entry.title}
            </a>
          ) : (
            entry.title
          )}
        </h1>
        <div className={styles.meta}>
          {entry.author && <span>{entry.author}</span>}
          {entry.feed_title && <span>{entry.feed_title}</span>}
          {entry.published_at && (
            <span>{new Date(entry.published_at).toLocaleString()}</span>
          )}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionButton} ${entry.is_read ? styles.active : ""}`}
            onClick={onToggleRead}
          >
            {entry.is_read ? "Mark unread" : "Mark read"}
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${entry.is_starred ? styles.active : ""}`}
            onClick={onToggleStar}
          >
            {entry.is_starred ? "Unstar" : "Star"}
          </button>
        </div>
      </div>
      <div
        className={styles.content}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized RSS content
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(entry.content ?? entry.summary ?? ""),
        }}
      />
    </article>
  );
}
