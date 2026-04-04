import { XMLParser } from "fast-xml-parser";

type FeedMeta = {
  title: string;
  siteUrl: string;
};

export type FeedEntry = {
  guid: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  author: string;
  publishedAt: string;
};

type ParsedFeed = {
  meta: FeedMeta;
  entries: FeedEntry[];
};

// biome-ignore lint/suspicious/noExplicitAny: XML parser output is untyped
type XmlNode = Record<string, any>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ["item", "entry"].includes(name),
});

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);

  if (doc.rss) return parseRss2(doc.rss);
  if (doc["rdf:RDF"]) return parseRss1(doc["rdf:RDF"]);
  if (doc.feed) return parseAtom(doc.feed);

  throw new Error("Unknown feed format");
}

function parseRss2(rss: XmlNode): ParsedFeed {
  const channel: XmlNode = rss.channel ?? {};
  const items: XmlNode[] = channel.item ?? [];

  return {
    meta: {
      title: str(channel.title),
      siteUrl: str(channel.link),
    },
    entries: items.map((item) => ({
      guid: str(item.guid?.["#text"] ?? item.guid ?? item.link),
      url: str(item.link),
      title: str(item.title),
      content: str(item["content:encoded"] ?? item.description),
      summary: str(item.description),
      author: str(item["dc:creator"] ?? item.author),
      publishedAt: toIso(str(item.pubDate)),
    })),
  };
}

function parseRss1(rdf: XmlNode): ParsedFeed {
  const channel: XmlNode = rdf.channel ?? {};
  const items: XmlNode[] = rdf.item ?? [];

  return {
    meta: {
      title: str(channel.title),
      siteUrl: str(channel.link),
    },
    entries: items.map((item) => ({
      guid: str(item["@_rdf:about"] ?? item.link),
      url: str(item.link),
      title: str(item.title),
      content: str(item["content:encoded"] ?? item.description),
      summary: str(item.description),
      author: str(item["dc:creator"]),
      publishedAt: toIso(str(item["dc:date"])),
    })),
  };
}

function parseAtom(feed: XmlNode): ParsedFeed {
  const entries: XmlNode[] = feed.entry ?? [];
  const feedLink = extractAtomLink(feed.link);

  return {
    meta: {
      title: str(feed.title?.["#text"] ?? feed.title),
      siteUrl: feedLink,
    },
    entries: entries.map((entry) => ({
      guid: str(entry.id),
      url: extractAtomLink(entry.link),
      title: str(entry.title?.["#text"] ?? entry.title),
      content: str(entry.content?.["#text"] ?? entry.content),
      summary: str(entry.summary?.["#text"] ?? entry.summary),
      author: str(entry.author?.name),
      publishedAt: toIso(str(entry.published ?? entry.updated)),
    })),
  };
}

function extractAtomLink(link: unknown): string {
  if (Array.isArray(link)) {
    const alt = link.find(
      (l: XmlNode) => l["@_rel"] === "alternate" || !l["@_rel"],
    );
    return str(alt?.["@_href"] ?? link[0]?.["@_href"]);
  }
  return str(prop(link, "@_href") ?? link);
}

function prop(obj: unknown, key: string): unknown {
  if (typeof obj === "object" && obj !== null && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function toIso(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
