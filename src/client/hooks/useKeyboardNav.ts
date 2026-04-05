import { useEffect } from "react";
import type { Pane } from "../types";

type Options = {
  activePane: Pane;
  feeds: { id: string }[];
  entries: { id: string; url: string | null }[];
  selectedFeedId: string | null;
  selectedEntryId: string | null;
  entryUrl: string | null;
  onSelectFeed: (id: string | null) => void;
  onSelectEntry: (id: string) => void;
  onToggleStar: () => void;
  onFocusPane: (pane: Pane) => void;
};

export function useKeyboardNav(opts: Options) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      switch (e.key) {
        case "j":
          moveSelection(opts, 1);
          break;
        case "k":
          moveSelection(opts, -1);
          break;
        case "h":
          movePaneFocus(opts, -1);
          break;
        case "l":
          movePaneFocus(opts, 1);
          break;
        case "o":
          openEntry(opts);
          break;
        case "s":
          opts.onToggleStar();
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

const PANE_ORDER: Pane[] = ["feeds", "entries", "entry"];

function movePaneFocus(opts: Options, direction: 1 | -1) {
  const idx = PANE_ORDER.indexOf(opts.activePane);
  const next = PANE_ORDER[idx + direction];
  if (next) {
    opts.onFocusPane(next);
  }
}

function moveSelection(opts: Options, direction: 1 | -1) {
  if (opts.activePane === "feeds") {
    const ids = [null, ...opts.feeds.map((f) => f.id)];
    const idx = ids.indexOf(opts.selectedFeedId);
    const next = ids[idx + direction];
    if (next !== undefined) {
      opts.onSelectFeed(next);
    }
  } else if (opts.activePane === "entries") {
    const ids = opts.entries.map((e) => e.id);
    const idx = opts.selectedEntryId ? ids.indexOf(opts.selectedEntryId) : -1;
    const nextIdx = idx + direction;
    const nextId = ids[nextIdx];
    if (nextId) {
      opts.onSelectEntry(nextId);
    }
  }
}

function openEntry(opts: Options) {
  if (opts.entryUrl) {
    window.open(opts.entryUrl, "_blank", "noopener,noreferrer");
  }
}
