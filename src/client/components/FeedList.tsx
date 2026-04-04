import type { Feed } from "../api";
import styles from "./FeedList.module.css";

type Props = {
  feeds: Feed[];
  selectedFeedId: string | null;
  onSelectFeed: (feedId: string | null) => void;
};

export function FeedList({ feeds, selectedFeedId, onSelectFeed }: Props) {
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
    <ul className={styles.list}>
      <li
        className={`${styles.allItem} ${selectedFeedId === null ? styles.selected : ""}`}
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
                onSelect={() => onSelectFeed(feed.id)}
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
          onSelect={() => onSelectFeed(feed.id)}
        />
      ))}
    </ul>
  );
}

function FeedItem({
  feed,
  selected,
  onSelect,
}: {
  feed: Feed;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={`${styles.item} ${selected ? styles.selected : ""}`}
      onClick={onSelect}
      onKeyDown={() => {}}
    >
      <span className={styles.title}>{feed.title ?? feed.url}</span>
    </li>
  );
}
