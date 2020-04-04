# Forest

_A prototype tree editor for TypeScript_

## What is this?

Forest lets you write TypeScript programs [as trees](https://en.wikipedia.org/wiki/Abstract_syntax_tree) instead of as text. This software is a prototype - it's confusing, it's buggy and it's often slow. It's also the only tree editor for TypeScript, so it's pretty fun to try.

## Why another tree editor?

People have made [quite a few](https://www.reddit.com/r/nosyntax/wiki/projects) of these "tree editors" or "structure editors" already. Most of them support either new languages (which are designed to be edited as trees) or languages with relatively minimal syntax (like Clojure or Lisp). Forest is unique because it's an editor for (all of) TypeScript - a language with lots of syntax and many features. Forest lets us see how tree editing feels with a complex real world language.

## Try it

Check out the ["Hello world" tutorial](./doc/tutorials/hello-world.md).

## Developer guide

### Local dev server

- Install dependencies
  - `yarn`
- Generate templates
  - `cd src/logic/providers/typescript/ && node generate-templates.js`
- Start the server (**WARNING**: This is really unsafe!)
  - `node server-unsafe.js`
- Start the CRA dev server
  - `yarn start`
- Open the main page and edit (probably [http://localhost:3000](http://localhost:3000))

### Production build

A production build of this app may fail because the JavaScript heap grows larger than the default limit. To work around this, allow more memory to be used:

```
env NODE_OPTIONS="--max-old-space-size=8192" yarn build
```
