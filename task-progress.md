# Editing tasks

- `add-call-to-middle-of-chain`
  - support: good
- `add-condition-to-property`
  - support: good
- `add-condition-to-statement`
  - support: good
- `add-statement-to-method`
  - support: good
- `add-switch-case`
  - support: none
  - note: switch statement is not supported
- `add-to-middle-of-type-literal`
  - support: good
- `append-interface-field`
  - support: good
- `append-object-property`
  - support: good
- `change-type-parameters`
  - support: none
  - note: ClassDeclaration is not supported
- `change-value-prefix`
  - support: ok
  - note: strings can only be edited using the rename feature
- `extend-if-condition`
  - support: good
- `extract-part-of-if-condition`
  - support: good
- `prepend-to-conditional`
  - support: good
- `rename-related-declarations`
  - support: none
- `rename-wrap-object-properties`
  - support: ok
  - note:
    - delete has to be done last, otherwise you lose your cursor location
    - alternative: use marks before deleting
- `simplify-conditional`
  - support: good
- `wrap-action`
  - support: ok
  - note: live reformatting and paste during insert mode would be nice
- `wrap-arrow-function`
  - support: good
- `wrap-object-properties`
  - support: good
  - note: if using multi-cursor, use marks to deal with uneven length lists
