import {
  DocManager,
  initialDocManagerPublicState,
  MinimalKeyboardEvent,
  Mode,
} from "../doc-manager";
import { Doc } from "../interfaces";
import { docFromAst } from "../node-from-ts";
import { astFromTypescriptFileContent } from "../parse";
import { printTsSourceFile } from "../print";

function asPrettyDoc(uglyText: string): Doc {
  const uglyAst = astFromTypescriptFileContent(uglyText);
  const prettyText = printTsSourceFile(uglyAst);
  return docFromAst(astFromTypescriptFileContent(prettyText));
}

type EventHandler = "onKeyUp" | "onKeyDown" | "onKeyPress";

interface EventWithHandler {
  handler: EventHandler;
  event: MinimalKeyboardEvent;
}

const evEnter: EventWithHandler = {
  handler: "onKeyPress",
  event: { key: "Enter" },
};
const evEscape: EventWithHandler = {
  handler: "onKeyDown",
  event: { key: "Escape" },
};
const evBackspace: EventWithHandler = {
  handler: "onKeyDown",
  event: { key: "Backspace" },
};
const evSemi: EventWithHandler = {
  handler: "onKeyPress",
  event: { key: ";" },
};
const evAltSemi: EventWithHandler = {
  handler: "onKeyDown",
  event: { key: ";", altKey: true },
};

function eventsFromKeys(keys: string): EventWithHandler[] {
  return [...keys].map((char) => ({
    handler: "onKeyPress",
    event: { key: char },
  }));
}

describe("DocManager", () => {
  interface TestCase {
    label: string;
    initialText: string;
    events: EventWithHandler[];
    expectedText: string;
  }

  const makeRoundTripTest = (text: string): TestCase => ({
    label: `round trip: ${text}`,
    initialText: text,
    events: [],
    expectedText: text,
  });

  const cases: TestCase[] = [
    makeRoundTripTest('console.log("walrus")'),
    makeRoundTripTest("f(async <T>(x: T, y) => x + y)"),
    makeRoundTripTest("f(g(x), y).foo.bar().baz"),
    makeRoundTripTest("a!.b"),
    makeRoundTripTest("a.b!"),
    makeRoundTripTest("a?.b"),
    makeRoundTripTest("a?.()"),
    {
      label: "delete everything",
      initialText: 'console.log("walrus")',
      events: eventsFromKeys("d"),
      expectedText: "",
    },
    {
      label: "rewrite hello world",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("d"),
        evEnter,
        ...eventsFromKeys(`console.log('walrus')`),
        evEscape,
      ],
      expectedText: 'console.log("walrus")',
    },
    {
      label: "replace string in call argument",
      initialText: 'console.log("walrus")',
      events: [
        evSemi,
        ...eventsFromKeys("jd"),
        evEnter,
        ...eventsFromKeys('"hello"'),
        evEscape,
      ],
      expectedText: 'console.log("hello")',
    },
    {
      label: "change property name",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("h"),
        evSemi,
        ...eventsFromKeys("di"),
        ...eventsFromKeys(".warn"),
        evEscape,
      ],
      expectedText: 'console.warn("walrus")',
    },
    {
      label: "write arithmetic expression",
      initialText: "",
      events: [evEnter, ...eventsFromKeys("1*2/3+4**5+6*7*8"), evEscape],
      expectedText: "1*2/3+4**5+6*7*8",
    },
    {
      label: "flatly change arithmetic expression",
      initialText: "1*2/3+4**5+6*7*8",
      events: [evAltSemi, evSemi, ...eventsFromKeys("llllldi**"), evEscape],
      expectedText: "1*2/3**4**5+6*7*8",
    },
    {
      label: "backspace works and does not go too far",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("h"),
        evSemi,
        ...eventsFromKeys("di"),
        ...eventsFromKeys(".wa"),
        evBackspace,
        evBackspace,
        evBackspace,
        evBackspace,
        evBackspace,
        evBackspace,
        evBackspace,
        ...eventsFromKeys(".x"),
        evBackspace,
        ...eventsFromKeys("warn"),
        evEscape,
      ],
      expectedText: 'console.warn("walrus")',
    },
    {
      label: "insert statement",
      initialText: "f(x); g(y);",
      events: [
        evAltSemi,
        evSemi,
        ...eventsFromKeys("a"),
        ...eventsFromKeys(";h(z)"),
        evEscape,
      ],
      expectedText: "f(x); h(z); g(y);",
    },
  ];

  for (const c of cases) {
    test(c.label, () => {
      const initialDoc = asPrettyDoc(c.initialText);
      let publicState = initialDocManagerPublicState;
      const docManager = new DocManager(initialDoc, (s) => {
        publicState = s;
      });
      docManager.forceUpdate();

      for (const { handler, event } of c.events) {
        docManager[handler](event);
      }

      expect(publicState.doc.text).toEqual(asPrettyDoc(c.expectedText).text);
      expect(publicState.mode === Mode.Normal);
    });
  }
});
