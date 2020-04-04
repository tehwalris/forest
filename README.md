# Forest

_A prototype tree editor for TypeScript_

## What is this?

Forest lets you write TypeScript programs [as trees](https://en.wikipedia.org/wiki/Abstract_syntax_tree) instead of as text. This software is a prototype - it's confusing, it's buggy and it's often slow. It's also the only tree editor for TypeScript, so it's pretty fun to try.

## Why another tree editor?

People have made [quite a few](https://www.reddit.com/r/nosyntax/wiki/projects) of these "tree editors" or "structure editors" already. Most of them support either new languages (which are designed to be edited as trees) or languages with relatively minimal syntax (like Clojure or Lisp). Forest is unique because it's an editor for (all of) TypeScript - a language with lots of syntax and many features. Forest lets us see how tree editing feels with a complex real world language.

## Important design decisions

### No text display of code

The first versions of Forest had a side-by-side view: the [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) on one side, and a text version of the code on the other. This was the worst of both worlds. It took around 10 minutes to write FizzBuzz in that version of Forest. You couldn't understand the AST without looking at the text code. You also couldn't just look at the text, because when you navigated or edited you needed to look at the tree to understand what would happen. Whenever you would look between the two views you would lose your place.

This pain motivated the current display of Forest: only a tree. This makes it easier to navigate the tree and understand your edits. It makes it harder to see a lot of code at once though, and that's where simplified trees come in.

### Simplified trees for convenince

Since Forest only shows a tree, that tree has to be easy to read. The base of the tree in Forest is the TypeScript AST, which is not made for reading. Forest applies different _transforms_ to it to improve readibility.

For example given the AST object for `var bestNumber = 123` you can access the value `123` with `node.declarationList.declarations[0].initializer.text`. That's means a variable declaration has a tree which is around 5-6 levels deep. A transform in Forest simplifies this to a tree with only 2 levels - one node for the variable name (`bestNumber`) and one child for the value (`123`).

Even though Forest uses simplified trees, they all build on top of the original TypeScript AST. That means that if you turn off certain transforms, you can write any TypeScript that you could with text.

### Work directly with "real" files

Forest reads and writes normal `.ts` files. There's no special tree data format that you have to covert your code to to edit it.

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
