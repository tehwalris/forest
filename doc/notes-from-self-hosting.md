# Bugs

- [x] Insert sometimes doesn't work
  - Especially when inserting functions and if statements
  - Seems to depend on which side you insert on
  - `Error: unequal number of children`
  - Adding a space before the insertion seems to help sometimes
- [x] Inserting an arrow function without parens around the argument crashes
- [ ] Can't paste multiple items into any part of a TightExpression that's not on the very left
- [ ] Copying and pasting a whole ternary expression which is an array element pastes the three parts of the ternary as separate array elements
  - Same problem when pasting `a.b` over an array element
- [ ] When a prompt opens an you cancel it, the input area stops being focused and can only be focused somehow by opening devtools
- [ ] Can't paste binary operators

# Most important missing node support

- [ ] Classes
- [ ] Spread for array elements
- [ ] Binary operators for types
- [ ] Array syntax (x[]) for types
- [ ] JSX

# Most important missing features

- [x] Scroll with cursor
- [ ] Paste should try every level of `equivalentToContent` target lists
  - Pasting `Identifier` over a `BindingElement` does not work because the paste targets the `BindingElement`, not its inner `Identifier`
- [ ] Warn when closing unsaved file
- [ ] Paste from system clipboard (in insert mode)
- [ ] No way to swap two values without adding temporary code
- [ ] Jump to definition
- [ ] Search for filenames
- [ ] Showing syntax errors while typing
- [ ] Change command (instead of delete and insert)
- [ ] Multiple marks
- [ ] Creating files
