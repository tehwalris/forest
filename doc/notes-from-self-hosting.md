# Bugs

- [x] Insert sometimes doesn't work
  - Especially when inserting functions and if statements
  - Seems to depend on which side you insert on
  - `Error: unequal number of children`
  - Adding a space before the insertion seems to help sometimes
- [x] Inserting an arrow function without parens around the argument crashes
- [x] Can't paste multiple items into any part of a TightExpression that's not on the very left
- [x] Copying and pasting a whole ternary expression which is an array element pastes the three parts of the ternary as separate array elements
  - Same problem when pasting `a.b` over an array element
- [ ] When a prompt opens an you cancel it, the input area stops being focused and can only be focused somehow by opening devtools
- [x] Can't paste binary operators
- [x] Can't insert before for-of because text range starts inside paren
  - May be due to focus normalization
- [ ] Can't append to multiple lists where some are empty because the leading separator gets in the way
  - Example: Try to append argument `a` to both `f(x)` and `f()` - doesn't work in second case because you get `f(,a)`
  - This is not an issue with inserts (at the start of a list) because trailing commas are removed (like in `f(a,)`)
- [ ] Crash when pasting if statement before existing if statement
  - `oldParent must be a list`
  - Can't reproduce, but did see other weird behavior when pasting single `IfBranch` over a statement
- [x] Crash when inserting before a mark (sometimes? happened with an if statement)
  - `invalid focus`
  - same happens when deleting would change the path to a mark
- [ ] Example files crash
  - probably formatting related

# Most important missing node support

- [ ] Classes
- [ ] Spread for array elements
- [ ] Binary operators for types
- [ ] Array syntax (x[]) for types
- [ ] JSX

# Most important missing features

- [x] Scroll with cursor
- [x] Paste should try every level of `equivalentToContent` target lists
  - Pasting `Identifier` over a `BindingElement` does not work because the paste targets the `BindingElement`, not its inner `Identifier`
- [x] Structural search
- [ ] Repeat last search
- [ ] Initialize search with content under cursor
- [ ] Synchronized multi-cursor
- [ ] Change command (instead of delete and insert)
- [ ] No way to swap two values without adding temporary code
- [ ] Paste from system clipboard (in insert mode)
- [ ] Lightweight initializer search
- [x] Nested multi-cursor
- [x] Removing nested cursors (select inner or outer)
- [ ] Jump to definition
- [ ] Multiple marks
- [ ] Warn when closing unsaved file
- [ ] Showing syntax errors while typing
- [ ] Search for filenames
- [ ] Creating files
