import { LOCALES, readMessages, readMessagesFile } from "./support/messages.js";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT_URL = new URL("../", import.meta.url);
const SKIPPED_DIRECTORIES = new Set(["_locales", "node_modules", "tests"]);
const BRAND_NAME = "TickTockFocus";
const STORE_LIMITS = { name: 75, description: 132 };

const english = readMessages("en");
const englishKeys = Object.keys(english);
const translatedLocales = LOCALES.filter((locale) => locale !== "en");
const messagesByLocale = new Map(LOCALES.map((locale) => [locale, readMessages(locale)]));

const placeholdersOf = (text) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name))].sort();

const countOccurrences = (text, part) => text.split(part).length - 1;

function listSourceFiles(directoryUrl) {
  return readdirSync(directoryUrl, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) return [];
      return listSourceFiles(new URL(`${entry.name}/`, directoryUrl));
    }
    return /\.(js|html)$/.test(entry.name) ? [new URL(entry.name, directoryUrl)] : [];
  });
}

const sourceText = listSourceFiles(ROOT_URL)
  .map((fileUrl) => readFileSync(fileUrl, "utf8"))
  .join("\n");
const manifestText = readFileSync(new URL("manifest.json", ROOT_URL), "utf8");
const manifest = JSON.parse(manifestText);

const matchAll = (text, pattern) => [...text.matchAll(pattern)].map(([, key]) => key);

describe("locale files", () => {
  test("include the default locale of the manifest", () => {
    assert.equal(manifest.default_locale, "en");
    assert.ok(LOCALES.includes(manifest.default_locale));
    assert.ok(translatedLocales.length > 0);
  });

  test("list the same keys in the same order in every locale", () => {
    for (const locale of translatedLocales) {
      assert.deepEqual(Object.keys(messagesByLocale.get(locale)), englishKeys, locale);
    }
  });

  test("use the same placeholders as English for every key", () => {
    for (const locale of translatedLocales) {
      const messages = messagesByLocale.get(locale);
      for (const key of englishKeys) {
        assert.deepEqual(
          placeholdersOf(messages[key].message),
          placeholdersOf(english[key].message),
          `${locale} ${key}`
        );
      }
    }
  });

  test("have no empty message", () => {
    for (const [locale, messages] of messagesByLocale) {
      for (const [key, { message }] of Object.entries(messages)) {
        assert.equal(typeof message, "string", `${locale} ${key}`);
        assert.notEqual(message.trim(), "", `${locale} ${key}`);
      }
    }
  });

  test("use {name} placeholders only, never Chrome's $ syntax", () => {
    for (const [locale, messages] of messagesByLocale) {
      for (const [key, { message }] of Object.entries(messages)) {
        assert.ok(!message.includes("$"), `${locale} ${key}`);
      }
    }
  });

  test("keep a separator between a stage label and its position", () => {
    for (const [locale, messages] of messagesByLocale) {
      for (const [key, { message }] of Object.entries(messages)) {
        assert.doesNotMatch(message, /\{label\}\s*\{n\}/, `${locale} ${key}`);
      }
    }
  });

  test("name every message in a way Chrome accepts, unique even ignoring case", () => {
    for (const locale of LOCALES) {
      const keys = matchAll(readMessagesFile(locale), /"(\w+)"\s*:\s*\{/g);
      assert.deepEqual(keys, Object.keys(messagesByLocale.get(locale)), locale);
      for (const key of keys) {
        assert.match(key, /^[A-Za-z][A-Za-z0-9_]*$/, `${locale} ${key}`);
      }
      const lowerCaseKeys = new Set(keys.map((key) => key.toLowerCase()));
      assert.equal(lowerCaseKeys.size, keys.length, locale);
    }
  });

  test("keep the name TickTockFocus as it is", () => {
    for (const locale of translatedLocales) {
      const messages = messagesByLocale.get(locale);
      for (const key of englishKeys) {
        assert.equal(
          countOccurrences(messages[key].message, BRAND_NAME),
          countOccurrences(english[key].message, BRAND_NAME),
          `${locale} ${key}`
        );
      }
    }
  });

  test("give the language code of their folder", () => {
    for (const [locale, messages] of messagesByLocale) {
      assert.equal(messages.languageCode.message, locale.replace("_", "-"));
    }
  });
});

describe("manifest", () => {
  test("takes its name, description and toolbar title from the messages", () => {
    assert.equal(manifest.name, "__MSG_extensionName__");
    assert.equal(manifest.description, "__MSG_extensionDescription__");
    assert.equal(manifest.action.default_title, "__MSG_actionTitle__");
  });

  test("fits the Chrome Web Store limits in every locale", () => {
    for (const [locale, messages] of messagesByLocale) {
      const nameLength = [...messages.extensionName.message].length;
      const descriptionLength = [...messages.extensionDescription.message].length;
      assert.ok(nameLength <= STORE_LIMITS.name, `${locale} name: ${nameLength}`);
      assert.ok(
        descriptionLength <= STORE_LIMITS.description,
        `${locale} description: ${descriptionLength}`
      );
    }
  });
});

describe("messages in the code", () => {
  test("every message is used somewhere", () => {
    const unusedKeys = englishKeys.filter(
      (key) => !sourceText.includes(`"${key}"`) && !manifestText.includes(`__MSG_${key}__`)
    );
    assert.deepEqual(unusedKeys, []);
  });

  test("every message the code asks for exists", () => {
    const usedKeys = [
      ...matchAll(sourceText, /translate\(\s*"([^"]*)"/g),
      ...matchAll(sourceText, /data-ui-(?:text|label)="([^"]*)"/g),
      ...matchAll(manifestText, /__MSG_(\w+)__/g),
    ];
    assert.deepEqual(
      usedKeys.filter((key) => !Object.hasOwn(english, key)),
      []
    );
  });
});
