# Bugs

- Insert sometimes doesn't work
  - Especially when inserting functions and if statements
  - Seems to depend on which side you insert on
- Inserting an arrow function without parens around the argument crashes
- Can't paste binary operators

# Most important missing node support

- Classes
- Spread for array elements
- Binary operators for types
- Array syntax (x[]) for types
- JSX

# Most important missing features

- Scroll with cursor
- Paste should try every level of `equivalentToContent` target lists
  - Pasting `Identifier` over a `BindingElement` does not work because the paste targets the `BindingElement`, not its inner `Identifier`
- Warn when closing unsaved file
- Paste from system clipboard (in insert mode)
- Search for filenames
- Jump to definition
- Showing syntax errors while typing
- Multiple marks
- Creating files
