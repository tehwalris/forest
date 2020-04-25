![Banner with screenshot of Forest](https://raw.githubusercontent.com/tehwalris/forest-tutorials/master/images/general/banner-1.png)

# Forest

_A prototype tree editor for TypeScript_

Forest lets you write TypeScript programs [as trees](https://en.wikipedia.org/wiki/Abstract_syntax_tree) instead of as text. This software is a prototype - it's confusing, it's buggy and it's often slow. It's also the only tree editor for TypeScript, so it's pretty fun to try.

**Maintenance warning** This prototype is no longer maintained. Building it gave me a lot of insights into the challenges of tree editing. I also gained an appreciation for code-as-text, despite the limitations which that has. I'll keep the [demo of Forest](https://forest.walr.is) running. Any feedback is still welcome.

## Try it

- Check out the ["Hello world" tutorial video](https://www.youtube.com/watch?v=9OcT_a8V1nc) (or [text version](https://github.com/tehwalris/forest-tutorials/blob/master/hello-world.md))
- [Play with Forest](https://forest.walr.is)
- Watch the ["Beyond hello world" tutorial video](https://www.youtube.com/watch?v=yYMt7e5i2xs)

## Why another tree editor?

People have made [quite a few](https://www.reddit.com/r/nosyntax/wiki/projects) of these "tree editors" or "structure editors" already. Most of them support either their own custom languages (which are designed to be edited as trees) or languages with relatively minimal syntax (like Clojure or Lisp). Forest is unique because it's an editor for (all of) TypeScript - a language with lots of syntax and many features. Forest lets us see how tree editing feels with a complex real world language.

## More

- The [developer guide](./doc/dev.md) explains how to compile Forest yourself
- There's a guide to [using Forest with your real filesystem](./doc/filesystem.md)
- ~~There's also a [rough roadmap](./doc/roadmap.md)~~ (see maintenance warning above)
