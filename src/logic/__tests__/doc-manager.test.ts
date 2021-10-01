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
    skip?: boolean;
  }

  const makeRoundTripTest = (text: string): TestCase => ({
    label: `round trip: ${text}`,
    initialText: text,
    events: [],
    expectedText: text,
  });
  makeRoundTripTest.skip = (text: string): TestCase => ({
    ...makeRoundTripTest(text),
    skip: true,
  });

  const cases: TestCase[] = [
    makeRoundTripTest('console.log("walrus")'),
    makeRoundTripTest("f(async <T>(x: T, y) => x + y)"),
    makeRoundTripTest.skip('f(): string => "abc"'),
    makeRoundTripTest("f(g(x), y).foo.bar().baz"),
    makeRoundTripTest("a!.b"),
    makeRoundTripTest("a.b!"),
    makeRoundTripTest("a?.b"),
    makeRoundTripTest("a?.()"),
    makeRoundTripTest(`
      if (1 === 0) {
        throw new Error("unreachable");
      }
    `),
    makeRoundTripTest(`
      if (Date.now() % 100 == 0) {
        console.log("lucky you");
      } else if (walrus) {
        console.log("even better");
      }
    `),
    makeRoundTripTest(`
      if (Date.now() % 100 == 0) {
        console.log("lucky you");
      } else {
        console.log("not so lucky");
      }
    `),
    makeRoundTripTest(`
      if (Date.now() % 100 == 0) {
        console.log("lucky you");
      } else if (walrus) {
        console.log("even better");
      } else if (1 === 0) {
        throw new Error("unreachable");
      }
    `),
    makeRoundTripTest(`
      if (Date.now() % 100 == 0) {
        console.log("lucky you");
      } else if (walrus) {
        console.log("even better");
      } else {
        throw new Error("not so lucky");
      }
    `),
    makeRoundTripTest("var x = y"),
    makeRoundTripTest.skip("const x = y"),
    makeRoundTripTest.skip("let x = y"),
    makeRoundTripTest.skip("let x: string"),
    makeRoundTripTest.skip("let x: string = 0, y: number = 1, z = 2"),
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
      label:
        "change arithmetic expression with parens which keeps them required",
      initialText: "a*(b+c)",
      events: [
        evSemi,
        ...eventsFromKeys("j"),
        evSemi,
        ...eventsFromKeys("hdi-"),
        evEscape,
      ],
      expectedText: "a*(b-c)",
    },
    {
      label:
        "change arithmetic expression with parens which makes them optional",
      initialText: "a*(b+c)",
      events: [
        evSemi,
        ...eventsFromKeys("j"),
        evSemi,
        ...eventsFromKeys("hdi*"),
        evEscape,
      ],
      expectedText: "a*(b*c)",
      skip: true,
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
    {
      label: "delete non-last statement in block",
      initialText: `
        if (1 === 0) {
          console.log("walrus");
          console.log("seal");
        }
      `,
      events: [evSemi, ...eventsFromKeys("j"), evSemi, ...eventsFromKeys("d")],
      expectedText: `
        if (1 === 0) {
          console.log("walrus");
        }
      `,
    },
    {
      label: "delete last statement in block",
      initialText: `
        if (1 === 0) {
          console.log("walrus");
          console.log("seal");
        }
      `,
      events: [evSemi, ...eventsFromKeys("j"), evSemi, ...eventsFromKeys("d")],
      expectedText: `
        if (1 === 0) {
          console.log("walrus");
        }
      `,
    },
    {
      label: "delete middle else-if",
      initialText: `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else if (walrus) {
          console.log("even better");
        } else if (1 === 0) {
          throw new Error("unreachable");
        }
      `,
      events: [...eventsFromKeys("H"), evSemi, ...eventsFromKeys("d")],
      expectedText: `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else if (1 === 0) {
          throw new Error("unreachable");
        }
      `,
    },
    {
      label: "make else-if into else",
      initialText: `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else if (walrus) {
          console.log("even better");
        }
      `,
      events: [evSemi, ...eventsFromKeys("H"), ...eventsFromKeys("d")],
      expectedText: `
        if (Date.now() % 100 == 0) {
          console.log("lucky you");
        } else {
          console.log("even better");
        }
      `,
    },
  ];

  for (const c of cases) {
    (c.skip ? test.skip : test)(c.label, () => {
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
