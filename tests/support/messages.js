import { readFileSync, readdirSync } from "node:fs";
import { setMessageLookup } from "../../shared/i18n.js";

export const LOCALES_URL = new URL("../../_locales/", import.meta.url);

export const LOCALES = readdirSync(LOCALES_URL, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export const readMessagesFile = (locale) =>
  readFileSync(new URL(`${locale}/messages.json`, LOCALES_URL), "utf8");

export const readMessages = (locale) => JSON.parse(readMessagesFile(locale));

function createMessageLookup(locale) {
  const messages = readMessages(locale);
  return (key) => {
    if (!Object.hasOwn(messages, key)) throw new Error(`Missing message: ${key}`);
    return messages[key].message;
  };
}

export const useLocale = (locale) => setMessageLookup(createMessageLookup(locale));

export function withLocale(locale, callback) {
  useLocale(locale);
  try {
    return callback();
  } finally {
    useLocale("en");
  }
}

useLocale("en");
