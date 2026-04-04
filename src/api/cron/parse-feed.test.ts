import { describe, expect, test } from "vitest";
import { parseFeed } from "./parse-feed";

describe("parseFeed", () => {
  test("parses RSS 2.0", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
		<rss version="2.0">
			<channel>
				<title>Example Blog</title>
				<link>https://example.com</link>
				<item>
					<title>First Post</title>
					<link>https://example.com/first</link>
					<guid>https://example.com/first</guid>
					<description>A summary</description>
					<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
					<author>alice@example.com</author>
				</item>
			</channel>
		</rss>`;

    const result = parseFeed(xml);

    expect(result.meta.title).toBe("Example Blog");
    expect(result.meta.siteUrl).toBe("https://example.com");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe("First Post");
    expect(result.entries[0].url).toBe("https://example.com/first");
    expect(result.entries[0].guid).toBe("https://example.com/first");
    expect(result.entries[0].summary).toBe("A summary");
    expect(result.entries[0].publishedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  test("parses Atom", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
		<feed xmlns="http://www.w3.org/2005/Atom">
			<title>Atom Blog</title>
			<link href="https://atom.example.com" rel="alternate"/>
			<entry>
				<title>Atom Entry</title>
				<id>urn:uuid:1234</id>
				<link href="https://atom.example.com/entry" rel="alternate"/>
				<summary>Atom summary</summary>
				<published>2024-06-15T12:00:00Z</published>
				<author><name>Bob</name></author>
			</entry>
		</feed>`;

    const result = parseFeed(xml);

    expect(result.meta.title).toBe("Atom Blog");
    expect(result.meta.siteUrl).toBe("https://atom.example.com");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe("Atom Entry");
    expect(result.entries[0].guid).toBe("urn:uuid:1234");
    expect(result.entries[0].url).toBe("https://atom.example.com/entry");
    expect(result.entries[0].author).toBe("Bob");
  });

  test("parses RSS 1.0 (RDF)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
		<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
				 xmlns:dc="http://purl.org/dc/elements/1.1/"
				 xmlns="http://purl.org/rss/1.0/">
			<channel>
				<title>RDF Blog</title>
				<link>https://rdf.example.com</link>
			</channel>
			<item rdf:about="https://rdf.example.com/post1">
				<title>RDF Post</title>
				<link>https://rdf.example.com/post1</link>
				<dc:creator>Charlie</dc:creator>
				<dc:date>2024-03-20T08:00:00Z</dc:date>
			</item>
		</rdf:RDF>`;

    const result = parseFeed(xml);

    expect(result.meta.title).toBe("RDF Blog");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].guid).toBe("https://rdf.example.com/post1");
    expect(result.entries[0].author).toBe("Charlie");
  });

  test("throws on unknown format", () => {
    expect(() => parseFeed("<html></html>")).toThrow("Unknown feed format");
  });
});
