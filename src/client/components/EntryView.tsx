import DOMPurify from "dompurify";
import { useState } from "react";
import type { EntryDetail } from "../api";
import { api } from "../api";
import styles from "./EntryView.module.css";

type ViewMode = "original" | "summary" | "translation";

type Props = {
  entry: EntryDetail | null;
  onToggleRead: () => void;
  onToggleStar: () => void;
};

export function EntryView({ entry, onToggleRead, onToggleStar }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("original");
  const [summary, setSummary] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<ViewMode | null>(null);

  if (!entry) {
    return <div className={styles.empty}>Select an entry to read</div>;
  }

  async function handleSummarize() {
    if (!entry) return;
    if (summary) {
      setViewMode("summary");
      return;
    }
    setLoadingMode("summary");
    const result = await api.summarize(entry.id);
    setLoadingMode(null);
    if (result.ok) {
      setSummary(result.data.summary);
      setViewMode("summary");
    }
  }

  async function handleTranslate() {
    if (!entry) return;
    if (translation) {
      setViewMode("translation");
      return;
    }
    setLoadingMode("translation");
    const result = await api.translate(entry.id);
    setLoadingMode(null);
    if (result.ok) {
      setTranslation(result.data.translation);
      setViewMode("translation");
    }
  }

  function getContent(current: EntryDetail): string {
    switch (viewMode) {
      case "summary":
        return summary ?? "";
      case "translation":
        return translation ?? "";
      default:
        return current.content ?? current.summary ?? "";
    }
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
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${viewMode === "original" ? styles.activeTab : ""}`}
            onClick={() => setViewMode("original")}
          >
            Original
          </button>
          <button
            type="button"
            className={`${styles.tab} ${viewMode === "summary" ? styles.activeTab : ""}`}
            onClick={handleSummarize}
            disabled={loadingMode !== null}
          >
            {loadingMode === "summary" ? "..." : "Summary"}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${viewMode === "translation" ? styles.activeTab : ""}`}
            onClick={handleTranslate}
            disabled={loadingMode !== null}
          >
            {loadingMode === "translation" ? "..." : "Translate"}
          </button>
        </div>
      </div>
      {loadingMode ? (
        <div className={styles.skeleton} />
      ) : (
        <div
          className={styles.content}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized RSS content
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(getContent(entry)),
          }}
        />
      )}
    </article>
  );
}
