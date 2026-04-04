import type { ReactNode } from "react";
import styles from "./Layout.module.css";

type Props = {
  feedList: ReactNode;
  entryList: ReactNode;
  entryView: ReactNode;
  onLogout: () => void;
};

export function Layout({ feedList, entryList, entryView, onLogout }: Props) {
  return (
    <div className={styles.layout}>
      <div className={styles.feedList}>
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
      <div className={styles.entryList}>{entryList}</div>
      <div className={styles.entryView}>{entryView}</div>
    </div>
  );
}
