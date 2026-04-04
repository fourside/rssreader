import { describe, expect, test } from "vitest";
import { stripHtml } from "./strip-html";

describe("stripHtml", () => {
  test("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  test("decodes named entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &apos;")).toBe("& < > \" '");
  });

  test("decodes decimal numeric entities", () => {
    expect(stripHtml("&#169; &#8212;")).toBe("\u00A9 \u2014");
  });

  test("decodes hex numeric entities", () => {
    expect(stripHtml("&#xA9; &#x2014;")).toBe("\u00A9 \u2014");
  });

  test("collapses whitespace", () => {
    expect(stripHtml("  hello\n\n  world  ")).toBe("hello world");
  });

  test("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });
});
