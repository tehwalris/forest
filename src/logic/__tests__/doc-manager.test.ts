import {
  DocManager,
  initialDocManagerPublicState,
  MinimalKeyboardEvent,
  Mode,
} from "../doc-manager";
import { Doc } from "../interfaces";
import { docFromAst } from "../node-from-ts";
import { astFromTypescriptFileContent } from "../parse";
import { prettyPrintTsSourceFile } from "../print";

function asPrettyDoc(uglyText: string): Doc {
  const uglyAst = astFromTypescriptFileContent(uglyText);
  const prettyText = prettyPrintTsSourceFile(uglyAst);
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
    makeRoundTripTest('f(): string => "abc"'),
    makeRoundTripTest("f(g(x), y).foo[123].bar().baz"),
    makeRoundTripTest("a!.b"),
    makeRoundTripTest("a.b!"),
    makeRoundTripTest("a?.b"),
    makeRoundTripTest("a?.()"),
    makeRoundTripTest("a?.[123]"),
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
    makeRoundTripTest("const x = y"),
    makeRoundTripTest("let x = y"),
    makeRoundTripTest("let x: string"),
    makeRoundTripTest("let x: string = 0, y: number = 1, z = 2"),
    makeRoundTripTest.skip("const x = { abc: def, [test]: 123, bla() { } }"),
    makeRoundTripTest("const x = { x: y, y: z }"),
    makeRoundTripTest("const x = [abc, 123, (x) => y]"),
    makeRoundTripTest("interface X extends A, B {}"),
    makeRoundTripTest("f([])"),
    makeRoundTripTest.skip(
      "const [queue, setQueue] = useState<DelayedInput[]>([]);",
    ),
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
    {
      label: "make normal object property into shorthand",
      initialText: "const x = { y: z }",
      events: [
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        evAltSemi,
        ...eventsFromKeys("Ld"),
      ],
      expectedText: "const x = { y }",
    },
    {
      label: "make shorthand object property into spread",
      initialText: "const x = { y }",
      events: [
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        ...eventsFromKeys("i..."),
        evEscape,
      ],
      expectedText: "const x = { ...y }",
    },
    {
      label: "change object property initializer using placeholder",
      initialText: "const x = { y: z }",
      events: [
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        evSemi,
        ...eventsFromKeys("da:a"),
        evEscape,
      ],
      expectedText: "const x = { y: a }",
    },
    {
      label: "change object property name using placeholder",
      initialText: "const x = { y: z }",
      events: [
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        evAltSemi,
        evSemi,
        ...eventsFromKeys("dia:"),
        evEscape,
      ],
      expectedText: "const x = { a: z }",
    },
    {
      label: "change spread assignment expression using placeholder",
      initialText: "const x = { ...y }",
      events: [
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        evSemi,
        ...eventsFromKeys("daa"),
        evEscape,
      ],
      expectedText: "const x = { ...a }",
    },
    {
      label: "add statement to block",
      initialText: "const x = () => { y() }",
      events: [
        evSemi,
        evSemi,
        evSemi,
        ...eventsFromKeys("j"),
        ...eventsFromKeys("a;z()"),
        evEscape,
      ],
      expectedText: "const x = () => { y(); z() }",
    },
    {
      label: "change expression of return statement",
      initialText: "return a",
      events: [
        evSemi,
        ...eventsFromKeys("d"),
        ...eventsFromKeys("a b"),
        evEscape,
      ],
      expectedText: "return b",
    },
    {
      label:
        "convert return statement into expression statement and back (basic)",
      initialText: "return f()",
      events: [evAltSemi, evSemi, ...eventsFromKeys("direturn "), evEscape],
      expectedText: "return f()",
    },
    {
      label:
        "convert return statement into expression statement and back (after other statement)",
      initialText: "g(); return f()",
      events: [
        evSemi,
        evAltSemi,
        evSemi,
        ...eventsFromKeys("direturn "),
        evEscape,
      ],
      expectedText: "g(); return f()",
    },
    {
      label:
        "convert return statement into expression statement (requires parens)",
      initialText: "return {animal: 'walrus'}",
      events: [evAltSemi, evSemi, ...eventsFromKeys("d")],
      expectedText: "({animal: 'walrus'})",
      skip: true,
    },
    {
      label: "change expression of throw statement",
      initialText: "throw new Error('test')",
      events: [
        evSemi,
        ...eventsFromKeys("d"),
        ...eventsFromKeys("a'walrus'"),
        evEscape,
      ],
      expectedText: "throw 'walrus'",
    },
    {
      label:
        "convert throw statement into expression statement and back (basic)",
      initialText: "throw new Error('test')",
      events: [evAltSemi, evSemi, ...eventsFromKeys("dithrow "), evEscape],
      expectedText: "throw new Error('test')",
    },
    {
      label:
        "convert throw statement into expression statement (requires parens)",
      initialText: "throw {animal: 'walrus'}",
      events: [evAltSemi, evSemi, ...eventsFromKeys("d")],
      expectedText: "({animal: 'walrus'})",
      skip: true,
    },
    {
      label: "add and remove export from type alias declaration",
      initialText: "type X = Y",
      events: [
        ...eventsFromKeys("iexport "),
        evEscape,
        ...eventsFromKeys("K"),
        evAltSemi,
        evSemi,
        ...eventsFromKeys("d"),
      ],
      expectedText: "type X = Y",
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
