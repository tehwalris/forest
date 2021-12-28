import { DocManager, MinimalKeyboardEvent } from "../logic/doc-manager";
import { unreachable } from "../logic/util";
import { EventCreator, EventCreatorKind } from "./interfaces";

export type EventHandler = "onKeyUp" | "onKeyDown" | "onKeyPress";
export interface EventWithHandler {
  handler: EventHandler;
  event: MinimalKeyboardEvent;
}
export interface SpecialKey {
  name: string;
  key?: string;
  addToEvent?: (ev: MinimalKeyboardEvent) => MinimalKeyboardEvent;
  handler?: EventHandler;
}
const specialKeys: SpecialKey[] = [
  { name: "enter", key: "Enter" },
  { name: "space", key: " " },
  { name: "escape", key: "Escape", handler: "onKeyDown" },
  { name: "backspace", key: "Backspace", handler: "onKeyDown" },
  {
    name: "ctrl",
    addToEvent: (ev) => ({ ...ev, ctrlKey: true }),
    handler: "onKeyDown",
  },
  {
    name: "alt",
    addToEvent: (ev) => ({ ...ev, altKey: true }),
    handler: "onKeyDown",
  },
  {
    name: "shift",
    addToEvent: (ev) => {
      if (ev.key.length !== 1 || ev.key === ev.key.toUpperCase()) {
        throw new Error("can't add shift to this key");
      }
      return { ...ev, key: ev.key.toUpperCase() };
    },
  },
];
export function parseKeyCombo(combo: string): EventWithHandler {
  if (combo.toLowerCase() !== combo) {
    throw new Error("key combos must be lowercase");
  }
  let baseKey: string | undefined;
  const setBaseKey = (k: string) => {
    if (baseKey !== undefined) {
      throw new Error("combo can not contain multiple base keys");
    }
    baseKey = k;
  };
  const usedSpecialKeys: SpecialKey[] = [];
  for (const part of combo.split("-")) {
    if (part.length === 1) {
      setBaseKey(part);
    } else {
      const specialKey = specialKeys.find((s) => s.name === part);
      if (!specialKey) {
        throw new Error(`unknown special key: ${part}`);
      }
      usedSpecialKeys.push(specialKey);
      if (specialKey.key) {
        setBaseKey(specialKey.key);
      }
    }
  }
  if (baseKey === undefined) {
    throw new Error("combo contains no base key");
  }
  if (
    new Set(usedSpecialKeys.map((s) => s.handler).filter((v) => v)).size > 1
  ) {
    throw new Error("combo contains multiple conflicting handlers");
  }
  const handler =
    usedSpecialKeys.map((s) => s.handler).find((v) => v) || "onKeyPress";
  let event: MinimalKeyboardEvent = { key: baseKey };
  for (const specialKey of usedSpecialKeys) {
    if (specialKey.addToEvent) {
      event = specialKey.addToEvent(event);
    }
  }
  return { handler, event };
}
export function eventsFromKeys(keys: string): EventWithHandler[] {
  return keys
    .trim()
    .split(/\s+/)
    .map((combo) => parseKeyCombo(combo));
}
export function eventsToTypeString(keys: string): EventWithHandler[] {
  return [...keys].map((key) => ({ handler: "onKeyPress", event: { key } }));
}
export function eventsFromEventCreator(
  c: EventCreator,
): (EventWithHandler | ((docManager: DocManager) => void))[] {
  switch (c.kind) {
    case EventCreatorKind.FromKeys:
      return eventsFromKeys(c.keys);
    case EventCreatorKind.ToTypeString:
      return eventsToTypeString(c.string);
    case EventCreatorKind.Function:
      return [c.function];
    default:
      return unreachable(c);
  }
}
