import type { ReactNode } from "react";
import type { Pane } from "../types";
import styles from "./Layout.module.css";

type Props = {
  feedList: ReactNode;
  entryList: ReactNode;
  entryView: ReactNode;
  activePane: Pane;
  onBack: () => void;
  onLogout: () => void;
};

export function Layout({
  feedList,
  entryList,
  entryView,
  activePane,
  onBack,
  onLogout,
}: Props) {
  return (
    <div className={styles.layout}>
      <div
        className={`${styles.feedList} ${activePane === "feeds" ? styles.mobileActive : ""}`}
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
        className={`${styles.entryList} ${activePane === "entries" ? styles.mobileActive : ""}`}
      >
        <button type="button" className={styles.backButton} onClick={onBack}>
          &larr; Feeds
        </button>
        {entryList}
      </div>
      <div
        className={`${styles.entryView} ${activePane === "entry" ? styles.mobileActive : ""}`}
      >
        <button type="button" className={styles.backButton} onClick={onBack}>
          &larr; Entries
        </button>
        {entryView}
      </div>
    </div>
  );
}
