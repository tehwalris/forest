# Forest

_A multi-cursor structural editor prototype for TypeScript_

Forest is a structural editor for TypeScript. Being structural means that most editing commands modify the [AST](https://en.wikipedia.org/wiki/Abstract_syntax_tree) of the program and the text is printed to match. In Forest code is still shown as text and new code can be typed almost normally, but under the hood it's very different from a normal text editor.

Forest is also built from the ground up with multi-cursor editing in mind. It's the only structural editor which specially integrates multi-cursor features. This makes Forest an interactive equivalent to AST refactoring scripts (like jscodeshift scripts). By using the right combination of commands with multiple cursors, you can accomplish some tasks that you might normally write basic scripts for.

## Try it

Forest is a prototype - it's confusing, some basic stuff is unsupported and it sometimes slow. You'll need patience. I hope you have fun trying it anyway, since it's a pretty unique thing.

My [master's thesis presentation](https://youtu.be/ze_nJlKkckg) explains the concepts behind Forest and shows it in action. There's an [online demo of Forest](https://forest.walr.is/) which you can try for yourself. You'll need the list of keyboard shortcuts which are in the appendix of my [thesis](https://doi.org/10.3929/ethz-b-000526812). If you click "Load Forest repo" in the online demo you'll also get copies of all the examples.
