import { repeat } from "ramda";
import {
  DocManager,
  initialDocManagerPublicState,
  MinimalKeyboardEvent,
  Mode,
} from "../doc-manager";
import { Doc } from "../interfaces";
import { docFromAst } from "../node-from-ts";
import { astFromTypescriptFileContent } from "../parse";
import { prettyPrintTsString } from "../print";
function asPrettyDoc(uglyText: string): Doc {
  return docFromAst(
    astFromTypescriptFileContent(prettyPrintTsString(uglyText)),
  );
}
type EventHandler = "onKeyUp" | "onKeyDown" | "onKeyPress";
interface EventWithHandler {
  handler: EventHandler;
  event: MinimalKeyboardEvent;
}
interface SpecialKey {
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
function parseKeyCombo(combo: string): EventWithHandler {
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
        throw new Error(`unknown special key: ${specialKey}`);
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
function eventsFromKeys(keys: string): EventWithHandler[] {
  return keys
    .trim()
    .split(/\s+/)
    .map((combo) => parseKeyCombo(combo));
}
function eventsToTypeString(keys: string): EventWithHandler[] {
  return [...keys].map((key) => ({ handler: "onKeyPress", event: { key } }));
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
    makeRoundTripTest.skip("f(async <T>(x: T, y) => x + y)"),
    makeRoundTripTest('const f = (): string => "abc"'),
    makeRoundTripTest("f(g(x), y).foo[123].bar().baz"),
    makeRoundTripTest("f<T>(g(x), y)<K, V>()"),
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
    makeRoundTripTest(
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
        ...eventsFromKeys("d a"),
        ...eventsToTypeString(`console.log('walrus')`),
        ...eventsFromKeys("escape"),
      ],
      expectedText: 'console.log("walrus")',
    },
    {
      label: "replace string in call argument",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("( d ( i"),
        ...eventsToTypeString("'hello'"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: 'console.log("hello")',
    },
    {
      label: "change property name",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("ctrl-shift-l space d alt-h a"),
        ...eventsToTypeString(".warn"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: 'console.warn("walrus")',
    },
    {
      label: "write arithmetic expression",
      initialText: "",
      events: [
        ...eventsFromKeys("a"),
        ...eventsToTypeString("1*2/3+4**5+6*7*8"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "1*2/3+4**5+6*7*8",
    },
    {
      label: "flatly change arithmetic expression",
      initialText: "1*2/3+4**5+6*7*8",
      events: [
        ...eventsFromKeys("alt-h l l l l m l d shift-m a"),
        ...eventsToTypeString("**"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "1*2/3**4**5+6*7*8",
    },
    {
      label:
        "change arithmetic expression with parens which keeps them required",
      initialText: "a*(b+c)",
      events: [
        ...eventsFromKeys("( alt-h l d alt-h a"),
        ...eventsToTypeString("-"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "a*(b-c)",
    },
    {
      label:
        "change arithmetic expression with parens which makes them optional",
      initialText: "a*(b+c)",
      events: [
        ...eventsFromKeys("( alt-h l d alt-h a"),
        ...eventsToTypeString("*"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "a*(b*c)",
    },
    {
      label: "backspace works and does not go too far",
      initialText: 'console.log("walrus")',
      events: [
        ...eventsFromKeys("ctrl-shift-l space d alt-h a"),
        ...eventsToTypeString(".wa"),
        ...eventsFromKeys(repeat("backspace", 10).join(" ")),
        ...eventsToTypeString(".x"),
        ...eventsFromKeys("backspace"),
        ...eventsToTypeString("warn"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: 'console.warn("walrus")',
    },
    {
      label: "insert statement",
      initialText: "f(x); g(y);",
      events: [
        ...eventsFromKeys("alt-h a"),
        ...eventsToTypeString(";h(z)"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "f(x); h(z); g(y);",
    },
    {
      label: "delete first statement in block",
      initialText: `
        if (1 === 0) {
          console.log("walrus");
          console.log("seal");
        }
      `,
      events: eventsFromKeys("{ alt-h d"),
      expectedText: `
        if (1 === 0) {
          console.log("seal");
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
      events: eventsFromKeys("{ alt-l d"),
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
      events: eventsFromKeys("ctrl-shift-l space d"),
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
      events: eventsFromKeys("alt-l ctrl-shift-h d"),
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
      events: eventsFromKeys("{ alt-l d"),
      expectedText: "const x = { y }",
    },
    {
      label: "make shorthand object property into spread",
      initialText: "const x = { y }",
      events: [
        ...eventsFromKeys("{ i"),
        ...eventsToTypeString("..."),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const x = { ...y }",
    },
    {
      label: "change object property initializer",
      initialText: "const x = { y: z }",
      events: [
        ...eventsFromKeys("{ alt-l d a"),
        ...eventsToTypeString(":a"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const x = { y: a }",
    },
    {
      label: "change object property name",
      initialText: "const x = { y: z }",
      events: [
        ...eventsFromKeys("{ alt-h d i"),
        ...eventsToTypeString("a:"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const x = { a: z }",
    },
    {
      label: "change spread assignment expression using placeholder",
      initialText: "const x = { ...y }",
      events: [
        ...eventsFromKeys("{ alt-l d a"),
        ...eventsToTypeString("a"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const x = { ...a }",
    },
    {
      label: "add statement to block",
      initialText: "const x = () => { y() }",
      events: [
        ...eventsFromKeys("{ a"),
        ...eventsToTypeString(";z()"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const x = () => { y(); z() }",
    },
    {
      label: "change expression of return statement",
      initialText: "return a",
      events: [
        ...eventsFromKeys("alt-l d a"),
        ...eventsToTypeString(" b"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "return b",
    },
    {
      label:
        "convert return statement into expression statement and back (basic)",
      initialText: "return f()",
      events: [
        ...eventsFromKeys("alt-h d i"),
        ...eventsToTypeString("return "),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "return f()",
    },
    {
      label:
        "convert return statement into expression statement and back (after other statement)",
      initialText: "g(); return f()",
      events: [
        ...eventsFromKeys("alt-l alt-h d i"),
        ...eventsToTypeString("return "),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "g(); return f()",
    },
    {
      label:
        "convert return statement into expression statement (requires parens)",
      initialText: "return {animal: 'walrus'}",
      events: eventsFromKeys("alt-h d"),
      expectedText: "({animal: 'walrus'})",
      skip: true,
    },
    {
      label: "change expression of throw statement",
      initialText: "throw new Error('test')",
      events: [
        ...eventsFromKeys("alt-l d a"),
        ...eventsToTypeString("'walrus'"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "throw 'walrus'",
    },
    {
      label:
        "convert throw statement into expression statement and back (basic)",
      initialText: "throw new Error('test')",
      events: [
        ...eventsFromKeys("alt-h d i"),
        ...eventsToTypeString("throw "),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "throw new Error('test')",
    },
    {
      label:
        "convert throw statement into expression statement (requires parens)",
      initialText: "throw {animal: 'walrus'}",
      events: eventsFromKeys("alt-h d"),
      expectedText: "({animal: 'walrus'})",
      skip: true,
    },
    {
      label: "add and remove export from type alias declaration",
      initialText: "type X = Y",
      events: [
        ...eventsFromKeys("i"),
        ...eventsToTypeString("export "),
        ...eventsFromKeys("escape alt-h d"),
      ],
      expectedText: "type X = Y",
    },
    {
      label:
        "paste ExpressionStatement into Expression location (one of multiple statements)",
      initialText: "f(x); g(x)",
      events: eventsFromKeys("alt-l c ( p"),
      expectedText: "f(x); g(g(x))",
    },
    {
      label:
        "paste ExpressionStatement into Expression location (at root of file)",
      initialText: "f(x)",
      events: eventsFromKeys("c ( p"),
      expectedText: "f(f(x))",
    },
    {
      label: "delete value of property that is named with a reserved word",
      initialText: `const shortcuts = { delete: "space d" };`,
      events: [],
      expectedText: `const shortcuts = { delete: placeholder };`,
      skip: true,
    },
    {
      label: "paste Identifier into TypeReferenceNode location",
      initialText: "interface Test { f: T }",
      events: eventsFromKeys("ctrl-shift-l space c k { alt-l p"),
      expectedText: "interface Test { f: Test }",
    },
    {
      label:
        "insert interface (ending in braces) after normal statement (ending with semicolon) in source file",
      initialText: "console.log('walrus');",
      events: [
        ...eventsFromKeys("a"),
        ...eventsToTypeString(";interface T {}"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "console.log('walrus'); interface T {}",
    },
    {
      label:
        "insert interface (ending in braces) after normal statement (ending with semicolon) in block",
      initialText: "if (x) { console.log('walrus'); }",
      events: [
        ...eventsFromKeys("{ a"),
        ...eventsToTypeString(";interface T {}"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "if (x) { console.log('walrus'); interface T {} }",
    },
    {
      label: "insert arrow function without parens around argument",
      initialText: "",
      events: [
        ...eventsFromKeys("a"),
        ...eventsToTypeString("const f = x => x + 1"),
        ...eventsFromKeys("escape"),
      ],
      expectedText: "const f = (x) => x + 1",
    },
    {
      label:
        "paste Identifier over BindingElement which only has an Identifier",
      initialText: "const x = z; const { y } = z;",
      events: eventsFromKeys("alt-h alt-h l c k k l l p"),
      expectedText: "const x = z; const { x } = z;",
    },
    {
      label: "alt-h on delimited list with 1 item",
      initialText: "const x = [y.z];",
      events: eventsFromKeys("[ ] alt-h d"),
      expectedText: "const x = [];",
    },
    {
      label: "alt-h on delimited list with 2 items",
      initialText: "const x = [y.z, x.y.z];",
      events: eventsFromKeys("[ ] alt-h d"),
      expectedText: "const x = [x.y.z];",
    },
    {
      label: "paste single Identifier over PropertyAccessExpression",
      initialText: "const x = y; return a.b;",
      events: eventsFromKeys("alt-h alt-h l c l l shift-l space p"),
      expectedText: "const x = y; return x;",
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
