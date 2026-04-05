import type { ReactNode } from "react";
import type { Pane } from "../types";
import styles from "./Layout.module.css";

type Props = {
  feedList: ReactNode;
  entryList: ReactNode;
  entryView: ReactNode;
  activePane: Pane;
  focusPane: Pane;
  onBack: () => void;
  onLogout: () => void;
};

function paneClass(
  base: string | undefined,
  pane: Pane,
  activePane: Pane,
  focusPane: Pane,
): string {
  return [
    base ?? "",
    pane === activePane ? (styles.mobileActive ?? "") : "",
    pane === focusPane ? (styles.focused ?? "") : (styles.unfocused ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
}

export function Layout({
  feedList,
  entryList,
  entryView,
  activePane,
  focusPane,
  onBack,
  onLogout,
}: Props) {
  return (
    <div className={styles.layout}>
      <div
        className={paneClass(styles.feedList, "feeds", activePane, focusPane)}
      >
        <div className={styles.header}>
          <span>Feeds</span>
          <button
            className={styles.logoutButton}
            type="button"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
        {feedList}
      </div>
      <div
        className={paneClass(
          styles.entryList,
          "entries",
          activePane,
          focusPane,
        )}
      >
        <button type="button" className={styles.backButton} onClick={onBack}>
          &larr; Feeds
        </button>
        {entryList}
      </div>
      <div
        className={paneClass(styles.entryView, "entry", activePane, focusPane)}
      >
        <button type="button" className={styles.backButton} onClick={onBack}>
          &larr; Entries
        </button>
        {entryView}
      </div>
    </div>
  );
}
