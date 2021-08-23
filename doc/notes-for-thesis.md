# Catching up with the meeting

## Predictable navigation

- vim has predictable commands
  - for example you know that "dib" will always delete the contents of the current brackets
    - does not matter where in the brackets the cursor is exactly
    - in a normal editor the same operation requires
      - looking where the cursor is first
      - adjusting the click position
  - predictable commands are essential (?) for fast editing
- navigation with arrows problematic with display-as-text
  - either always use (e.g.) up-down to navigate siblings
    - confusing because the movement might visually go left-right
  - or match arrows to visual direction
    - so pressing right goes to the sibling that is visually on the right
    - problematic because text layout can vary, so you need to look before you move
- assign a letter to every child for navigation
  - instead of using arrows to move to and between children, use letter keys
  - for example when focused on a function pressing "n" would focus on the "name" child of the function
  - such shortcuts have no "direction"
    - they work the same no matter how the text is laid out
    - there's no need for feedback and no confusion, unlike with arrows

## Tree and transforms

- the tree design and transform concept are the core of the editor
  - both of these are closely linked
- they are also the most academic part
  - there is a lot of slightly-related research, but not match that is exactly the same
- there are multiple problems with the current design
  - tree nodes have no runtime types
    - transforms use hacks like looking at the names of children to guess the type of a node
  - there is no native support for important concepts
    - this makes code more complicated and less stable
    - the most important missing concept is holes
    - another important concept is explicit struct-like and list-like nodes
  - copy-paste is unstable
    - paste is handled by each node separately
    - in the TypeScript tree, "union" nodes handle pastes
    - nodes that are not unions can not handle pastes
      - very confusing for the user
      - transforms typically create such nodes, so pasting doesn't work with transforms
  - no lazy loading
    - the whole tree (all files in a project) must be loaded and transformed at once
    - long startup time
- transforms
  - the initial tree almost exactly wraps the TypeScript AST
  - some things in the AST are not practical for editing
    - most important examples
      - variables assignment statements have three levels of nesting
      - if-elseif-... statements are nested like if {} else { if {} else { if {} else {} } }
        - flat is much easier to browse and edit if {} elseif {} elseif {} else {}
      - expressions in statement position must be wrapped in ExpressionStatement
        - useless extra tree level when browsing
        - very confusing for new users (e.g. no visible option to put a function call inside a function body)
      - "implements" and "extends" on classes are grouped into three-level-deep arbitrary list structures
      - template strings require a pretty arbitrary structure that is hard to create by hand
  - to make editing practical, the annoying structures in the tree can be replaced by nicer ones
  - such a transform concept has lots of complicated details and tradeoffs
    - transforms must be two way
    - the transformed state sometimes does not correspond to a valid original state
      - e.g. flat if statement with 0 branches does not correspond to a TypeScript statement
      - the transformed state has to be stored extra to the original tree in this case
      - what is the source of truth in such a situation?
    - when and how should transforms be disabled?
      - should the user be able to locally disable a transform?
        - e.g. temporarily disable flat-if on a specific if statement
    - how is identity of nodes in a transform preserved?
      - e.g. for the flat if transform, where do the ids of the flat-if-branch nodes come from?
        - they could come from the original if statement AST parts, but this doesn't always work (e.g. for new branches)
        - they could be newly generated, but the they are not preserved if the transform is unapplied and reapplied
      - when IDs change, this causes issues in the UI
        - nodes are animated as exiting and entering even though they aren't
        - if the node in question is focused, it will lose focus
        - if the node in question is bookmarked, the bookmark will become invalid
  - relevant academic stuff
    - view update problem in databases
    - bidirectional lenses
    - code transform languages like txl

# Meeting 2021-08-11

## Overview

- visualization as text is done in ~90% of cases
- navigation using letter-per-child is done
- confirmed that visualization as text and navigation with letters are much better than the old solutions
  - interesting to compare the old approaches to the new ones in the evaluation
    - possibly by using the whole old version of forest as a baseline
- not clear what to focus on next
  - lots of different problems, but no clear priority

## Performance issues

- text visualization is slow on large files
  - still kind of usable
- optimizations within the existing design will not fundamentally solve the problem
  - they might make it fast enough for almost all files though
- real solution: the amount of work must depend on the amount of visible content
  - every stage must be lazy
    - parsing, transforms, pretty printing, final layout, animation
  - stop working exactly when the screen is full of content
- an end-to-end lazy system could be an interesting contribution
  - this alone is a whole thesis worth of work
- optimizations within the existing design are not an interesting contribution
  - some optimizations will still be necessary to keep using the editor self-hosted as more features are added

## Navigation issues

- deep structures require lots of steps "in"
  - example:
    - moving to a statement nested within objects and functions
    - required 7 steps in the structure editor
    - in a text editor you could just move 4 lines down
  - deep structures are very common in javascript
- navigating "out" in the tree is impractical
  - to get out of a deep tree structure, you have to guess how many levels deep you are
  - often you press backspace some number of times and then watch to see if that was too few or too many
  - could possibly be solved by marking siblings, siblings-of-parents, etc. with colors or numbers
    - for example, you see some node on the level you want to go marked "-7", so you know you need to go that many levels up
  - could allow searching for the nearest containing statement, block, etc.
- chains of single-child nodes are hard to navigate
  - example
    - consider a function with type parameters `<T>`
    - this is currently three nodes: (type parameter list) -> (type parameter) -> (name)
    - each node only has a single child
  - the text range of these nodes is very similar or even identical
  - it's hard to
    - remember how many levels of nodes there are
    - see which node you are focused on
    - remember which node has which functionality (e.g. only the type parameter list can be toggled to delete it)
  - possible solution: shortcut to navigate to the deepest node in a single child chain

## Naming issues

- TypeScript has many more types of AST nodes than old languages had
- many AST nodes seem similar to the user but are distinct in the AST
  - e.g. ObjectLiteralExpression, TypeLiteralNode, ObjectBindingPattern
- should similar AST nodes all "look the same" in the editor?
  - in the above example, all just be called "object"
  - partially this is already done by giving them similar shortcuts
    - "id" for Identifier and TypeReferenceNode
- realistic users would work with multiple languages at once
  - names and shortcuts for similar concepts should be the same across languages
  - shortcuts should be short and intuitive
  - there will probably be some conflicts
- optimizing naming and shortcuts is a whole thesis worth of work
  - possibly could analyze existing code to understand how to group and prioritize shortcuts

## Compiler integration

- a major usability problem in practice is that there are no warnings, autocomplete or auto-imports
- for modern languages these features are nearly necessary
- a plain text editor would also be much slower to use without them
- adding these features to a structural editor is not an interesting contribution
  - since the problems and solutions are the same as with plain text
- without these features full self-hosted use is not practical

## Search

- two kinds of search in a normal editor
  - language aware symbol search
  - general text search
- adding language aware symbol search is more part of compiler integration
- general text search would have to be replaced by general structural search in this editor
- structural search itself is not a new contribution
  - has already been researched and implemented in practice
- special aspect of structural search in this editor:
  - the query would be written using the same editor as normal code, but with extra placeholders
  - other systems have a separate UI or query language for structural search

## Focus on differences to old editors

- this was the general focus suggested by Manuel
- old editors had much simpler languages (PASCAL, PL/1, LISP)
- TypeScript is a much more complicated language
  - many different AST nodes (~3-4x more than PASCAL)
    - naming nodes and defining shortcuts is much harder
  - many more optional fields in AST (type parameters, async annotations, etc.)
    - hard to make these easy to edit, but not be in the way
  - many arbitrarily nested structures (most things are expressions)
    - pretty-printing requires algorithms instead of heuristics (e.g. newline after each statement)
    - navigation is harder (e.g. jump out to function is less meaningful when functions can be nested)
  - deep nesting is common (function containing object containing function etc.)
    - navigation requires many more steps (both in and out)
    - single-child-node chains almost didn't exist in old languages
- note that arbitrary and deep nesting would also have been a problem for LISP editors

## Conclusion

- read more related work
- try to more clearly identify what problems/solutions are novel compared to editors for old languages

# Meeting 2021-08-21

## Overview

- mainly read papers
- also made some improvements to Forest on the side

## Summary of papers

- looked mostly at papers from 1970-2005
- many Pascal editors
  - at least different ones 10 were created
- many of the of the problems that structure editors were designed to solve are solved in text editors now
  - interface to IDE-like features (autocomplete, refactors, etc.)
  - fault tolerant parsing makes this work
- pretty printing was almost always simple
  - just print keywords and call a function to print children
  - no wrapping logic based on line length
    - some languages are even have a 1-to-1 statement-line correspondence (FORTRAN?)
    - LISP pretty printers probably did this though
- different approaches to structure/text boundary
  - fully structure
  - structure up to expression level, text below (cutoff varies)
    - typical argument: editing expressions as structure is impractical
    - alternative argument:
      - developers don't think about expressions as trees
      - although they do think of higher levels (classes, functions, etc.) as trees
  - structure, but selected node can be added/edited as text
    - uses parser configured for that context
  - structure, but anything can be edited as text
    - either select smallest containing node of text region and convert it to text, then parse back
    - or split the parse tree around the region being edited, with some unparsed text in the middle
- varying navigation strategies
  - in some editors arrows move in text direction
  - in some editors arrows move in tree direction (eg. up moves to parent node)
  - ABC editor has an interesting widen/first/narrow/... mechanism
  - have not seen letter per child navigation like Forest has
- list handling
  - almost never discussed
  - ABC editor had the most interesting discussion
    - allows selecting a contiguous list of siblings
      - Forest currently does not have this, and it's really limiting when moving multiple statements around
- most interesting was thesis comparing editing times in a couple of structural editors
  - "The Design of the User Interface for Software Development Tools", MA Toleman, 1996
  - multiple small program creation and editing tasks (roughly 3-10 lines each)
  - used KLM (keyboard level model) to estimate editing times
  - experimentally measured editing times with multiple participants and compared to KLM
  - inspired by this, I did my own small KLM experiment with VIM and Forest
    - https://gist.github.com/tehwalris/b78020c56b6990923b2a34fb7e482b20

# Forest expression issues

- many of the same operator
  - example: a + b + c + d + e + f
  - this is treated as left-associative binary tree
  - browsing is impractical
    - elements on the right are shallow (e.g. f)
    - elements on the left are very deep (e.g. a)
  - deleting elements is impractical (especially from the middle)
    - navigate to the target element
    - select and copy it's left child
    - select the target element and replace it with the copied node
  - might be good to treat expressions as a list of tokens
    - maybe as a separate editing mode
- chains of property accesses
  - similar issues to many usages of an operator
  - special things like calls or TypeScript NonNullExpression ("!") mixed in between
- mixing operators (e.g. + and \*)
  - sometimes editing as a tree is nicer than a flat list
  - e.g. writing "(a _ b) + (c _ d)" vs "(a + b) \* (c + d)"
    - brackets are inserted naturally to give intended precedence when this is written as a tree

# Updates to Forest

- removed `ExpressionStatement`
  - expressions can be written in statement position
  - copy-paste works between expressions and statements containing expressions
- removed "Option" nodes
  - instead `Option<None>` is a choice in optional unions now
- optional lists are replaced by empty lists instead
  - e.g. function type parameters
  - less confusing because one less action required
- removed directional shortcuts
  - they were confusing with display-as-text
  - e.g. append child was "ctrl-right" and is now "space shift-a"
- setVariant and setFromString are triggered together
  - previously you would select a node, use setVariant and then use setFromString (if it was supported)
  - now when you press enter you first get the setVariant menu and then immediately after the setFromString input field
  - this means extra typing in some cases, but it is faster because you need to think less
    - e.g. if you want to change an existing string literal, you have to still select "st" from setVariant now
- setVariant is automatically triggered after adding a list element
  - appending a list node that you immediately replace is still as fast as before
    - using the paste shortcut in the setVariant menu will cancel setVariant and perform paste
