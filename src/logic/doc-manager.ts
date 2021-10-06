import { checkInsertion } from "./check-insertion";
import { docMapRoot, emptyDoc, getBeforePos } from "./doc-utils";
import {
  Doc,
  EvenPathRange,
  Focus,
  FocusKind,
  InsertState,
  NodeKind,
  Path,
} from "./interfaces";
import { memoize } from "./memoize";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqual,
  flipEvenPathRange,
  flipUnevenPathRange,
  focusesAreEqual,
  getPathToTip,
} from "./path-utils";
import {
  getDocWithAllPlaceholders,
  getDocWithoutPlaceholdersNearCursor,
} from "./placeholders";
import { printTsSourceFile } from "./print";
import { getDocWithInsert } from "./text";
import {
  nodeGetByPath,
  nodeMapAtPath,
  nodeTryGetDeepestByPath,
  nodeVisitDeep,
} from "./tree-utils/access";
import { filterNodes } from "./tree-utils/filter";
import { unreachable } from "./util";
import { withoutInvisibleNodes } from "./without-invisible";

export enum Mode {
  Normal,
  // TODO make generic insert mode
  InsertBefore,
  InsertAfter,
}

export interface DocManagerPublicState {
  doc: Doc;
  focus: Focus;
  mode: Mode;
}

export const initialDocManagerPublicState: DocManagerPublicState = {
  doc: emptyDoc,
  focus: { kind: FocusKind.Range, range: { anchor: [], tip: [] } },
  mode: Mode.Normal,
};

export interface MinimalKeyboardEvent {
  key: string;
  altKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export class DocManager {
  private focus: Focus = {
    kind: FocusKind.Range,
    range: { anchor: [], tip: [] },
  };
  private parentFocuses: EvenPathRange[] = [];
  private history: {
    doc: Doc;
    focus: Focus;
    parentFocuses: EvenPathRange[];
    insertState: InsertState;
  }[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private lastDoc = emptyDoc;
  private insertState: InsertState | undefined;
  private getDocWithoutPlaceholdersNearCursor = memoize(
    getDocWithoutPlaceholdersNearCursor,
  );

  constructor(
    private doc: Doc,
    private _onUpdate: (publicState: DocManagerPublicState) => void,
  ) {}

  forceUpdate() {
    if (this.mode !== Mode.Normal) {
      throw new Error("forceUpdate can only be called in normal mode");
    }
    this.onUpdate();
    this.history = [];
  }

  onKeyPress = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter" && this.focus.kind === FocusKind.Range) {
        const evenFocus = asEvenPathRange(this.focus.range);
        if (evenFocus.offset !== 0) {
          return;
        }
        const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
        if (focusedNode?.kind !== NodeKind.List || focusedNode.content.length) {
          return;
        }
        this.insertState = {
          beforePos: focusedNode.pos + focusedNode.delimiters[0].length,
          beforePath: [...evenFocus.anchor, 0],
          text: "",
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "Enter" && this.focus.kind === FocusKind.Location) {
        this.insertState = {
          beforePos: getBeforePos(this.doc, this.focus.before),
          beforePath: this.focus.before,
          text: "",
        };
        this.mode = Mode.InsertBefore;
      } else if (ev.key === "b") {
        if (this.focus.kind !== FocusKind.Range) {
          return;
        }
        let evenFocus = asEvenPathRange(this.focus.range);
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        this.focus = {
          kind: FocusKind.Location,
          before: evenFocus.anchor,
        };
      } else if (ev.key === "i") {
        if (this.focus.kind !== FocusKind.Range) {
          return;
        }
        let evenFocus = asEvenPathRange(this.focus.range);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const firstFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange(evenFocus),
        };

        const firstFocusedNode = nodeGetByPath(this.doc.root, firstFocusedPath);
        if (!firstFocusedNode) {
          throw new Error("invalid focus");
        }
        this.insertState = {
          beforePos: firstFocusedNode.pos,
          beforePath: firstFocusedPath,
          text: "",
        };
        this.mode = Mode.InsertBefore;
      } else if (ev.key === "a") {
        if (this.focus.kind !== FocusKind.Range) {
          return;
        }
        let evenFocus = asEvenPathRange(this.focus.range);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset > 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const lastFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange(evenFocus),
        };

        const lastFocusedNode = nodeGetByPath(this.doc.root, lastFocusedPath);
        if (!lastFocusedNode) {
          throw new Error("invalid focus");
        }
        this.insertState = {
          beforePos: lastFocusedNode.end,
          beforePath: [
            ...lastFocusedPath.slice(0, -1),
            lastFocusedPath[lastFocusedPath.length - 1] + 1,
          ],
          text: "",
        };
        this.mode = Mode.InsertAfter;
      } else if (ev.key === "d") {
        if (this.focus.kind !== FocusKind.Range) {
          return;
        }
        let evenFocus = asEvenPathRange(this.focus.range);
        let forwardFocus =
          evenFocus.offset < 0 ? flipEvenPathRange(evenFocus) : evenFocus;
        if (evenFocus.anchor.length === 0) {
          if (!this.doc.root.content.length) {
            return;
          }
          forwardFocus = {
            anchor: [0],
            offset: this.doc.root.content.length - 1,
          };
        }
        let newFocusIndex: number | undefined;
        this.doc = docMapRoot(
          this.doc,
          nodeMapAtPath(forwardFocus.anchor.slice(0, -1), (oldListNode) => {
            if (oldListNode?.kind !== NodeKind.List) {
              throw new Error("oldListNode is not a list");
            }
            const deleteFrom =
              forwardFocus.anchor[forwardFocus.anchor.length - 1];
            const deleteCount = forwardFocus.offset + 1;
            if (deleteFrom + deleteCount < oldListNode.content.length) {
              newFocusIndex = deleteFrom;
            } else if (deleteFrom > 0) {
              newFocusIndex = deleteFrom - 1;
            }

            const newContent = [...oldListNode.content];
            const newStructKeys = oldListNode.structKeys && [
              ...oldListNode.structKeys,
            ];
            newContent.splice(deleteFrom, deleteCount);
            newStructKeys?.splice(deleteFrom, deleteCount);
            return {
              ...oldListNode,
              content: newContent,
              structKeys: newStructKeys,
            };
          }),
        );
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange({
            anchor:
              newFocusIndex === undefined
                ? forwardFocus.anchor.slice(0, -1)
                : [...forwardFocus.anchor.slice(0, -1), newFocusIndex],
            offset: 0,
          }),
        };
      } else if (ev.key === "l") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, false));
      } else if (ev.key === "L") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(1, true));
      } else if (ev.key === "h") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, false));
      } else if (ev.key === "H") {
        this.untilEvenFocusChanges(() => this.tryMoveThroughLeaves(-1, true));
      } else if (ev.key === "k") {
        this.tryMoveOutOfList();
      } else if (ev.key === "K") {
        this.tryMoveToParent();
      } else if (ev.key === "j") {
        this.tryMoveIntoList();
      } else if (ev.key === ";") {
        if (this.focus.kind !== FocusKind.Range) {
          return;
        }
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange({
            anchor: getPathToTip(asEvenPathRange(this.focus.range)),
            offset: 0,
          }),
        };
      } else if (ev.key === "o") {
        console.log({
          doc: this.doc,
          focus: this.focus,
          tip:
            this.focus.kind === FocusKind.Range
              ? nodeGetByPath(
                  this.doc.root,
                  getPathToTip(asEvenPathRange(this.focus.range)),
                )
              : undefined,
          insertState: this.insertState,
        });
      }
    } else if (
      this.mode === Mode.InsertBefore ||
      this.mode === Mode.InsertAfter
    ) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (ev.key.length === 1) {
        ev.preventDefault?.();
        this.insertState = {
          ...this.insertState,
          text: this.insertState.text + ev.key,
        };
      }
    }

    this.onUpdate();
  };

  onKeyDown = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.Normal && ev.key === ";" && ev.altKey) {
      if (this.focus.kind !== FocusKind.Range) {
        return;
      }
      this.focus = {
        kind: FocusKind.Range,
        range: flipUnevenPathRange(this.focus.range),
      };
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }

      if (this.history.length > 1) {
        // TODO remove placeholders next to cursor during insert
        try {
          const initialPlaceholderInsertion =
            getDocWithoutPlaceholdersNearCursor(
              this.doc,
              this.insertState.beforePos,
            );

          const docWithInsert = docFromAst(
            astFromTypescriptFileContent(
              printTsSourceFile(
                astFromTypescriptFileContent(
                  getDocWithInsert(initialPlaceholderInsertion.doc, {
                    text: this.insertState.text,
                    beforePos: initialPlaceholderInsertion.cursorBeforePos,
                  }).text,
                ),
              ),
            ),
          );

          const checkedInsertion = checkInsertion(
            initialPlaceholderInsertion.doc.root,
            docWithInsert.root,
            initialPlaceholderInsertion.mapOldToWithoutAdjacent(
              this.insertState.beforePath,
            ),
          );
          if (!checkedInsertion.valid) {
            throw new Error("checkedInsertion is not valid");
          }

          nodeVisitDeep(
            initialPlaceholderInsertion.doc.root,
            (oldNode, oldPath) => {
              if (!oldNode.isPlaceholder) {
                return;
              }
              const newNode = nodeGetByPath(
                docWithInsert.root,
                checkedInsertion.pathMapper.mapRough(oldPath),
              );
              if (!newNode) {
                throw new Error("placeholder not found in new tree");
              }
              // HACK mutating docWithInsert
              newNode.isPlaceholder = true;
            },
          );

          const placeholderRemoval = filterNodes(
            docWithInsert.root,
            (node) => !node.isPlaceholder,
          );

          this.doc = { ...docWithInsert, root: placeholderRemoval.node };
          const mapPath = (p: Path) =>
            placeholderRemoval.pathMapper.mapRough(
              checkedInsertion.pathMapper.mapRough(
                initialPlaceholderInsertion.mapOldToWithoutAdjacent(p),
              ),
            );
          if (this.focus.kind === FocusKind.Range) {
            this.focus = {
              kind: FocusKind.Range,
              range: {
                anchor: mapPath(this.focus.range.anchor),
                tip: mapPath(this.focus.range.tip),
              },
            };
          } else if (this.focus.kind === FocusKind.Location) {
            this.focus = {
              kind: FocusKind.Location,
              before: mapPath(this.focus.before),
            };
          } else {
            return unreachable(this.focus);
          }
        } catch (err) {
          console.warn("insertion would make doc invalid", err);
          return;
        }
      }

      this.mode = Mode.Normal;
      this.history = [];
      this.parentFocuses = [];
      this.insertState = undefined;
      this.removeInvisibleNodes();
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Backspace"
    ) {
      if (this.history.length < 2) {
        return;
      }
      this.history.pop();
      const old = this.history.pop()!;
      this.doc = old.doc;
      this.focus = old.focus;
      this.parentFocuses = old.parentFocuses;
      this.insertState = old.insertState;
      this.onUpdate();
    }
  };

  onKeyUp = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      ev.stopPropagation?.();
      ev.preventDefault?.();
    }
  };

  private tryMoveOutOfList() {
    if (this.focus.kind !== FocusKind.Range) {
      return;
    }
    let evenFocus = asEvenPathRange(this.focus.range);
    while (evenFocus.anchor.length >= 2) {
      evenFocus = {
        anchor: evenFocus.anchor.slice(0, -1),
        offset: 0,
      };
      const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
      if (
        focusedNode?.kind === NodeKind.List &&
        !focusedNode.equivalentToContent
      ) {
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange(evenFocus),
        };
        return;
      }
    }
  }

  private tryMoveIntoList() {
    if (this.focus.kind !== FocusKind.Range) {
      return;
    }
    const evenFocus = asEvenPathRange(this.focus.range);
    if (evenFocus.offset !== 0) {
      return;
    }
    const listPath = evenFocus.anchor;
    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
      return;
    }
    this.focus = {
      kind: FocusKind.Range,
      range: asUnevenPathRange({
        anchor: [...listPath, 0],
        offset: listNode.content.length - 1,
      }),
    };
  }

  private tryMoveToParent() {
    if (this.focus.kind !== FocusKind.Range) {
      return;
    }
    let evenFocus = asEvenPathRange(this.focus.range);
    while (evenFocus.anchor.length) {
      const parentPath = evenFocus.anchor.slice(0, -1);
      const parentNode = nodeGetByPath(this.doc.root, parentPath);
      if (parentNode?.kind !== NodeKind.List) {
        throw new Error("parentNode is not a list");
      }

      const wholeParentSelected =
        Math.abs(evenFocus.offset) + 1 === parentNode.content.length;
      if (!wholeParentSelected) {
        evenFocus = {
          anchor: [...parentPath, 0],
          offset: parentNode.content.length - 1,
        };
        this.focus = {
          kind: FocusKind.Range,
          range: asUnevenPathRange(evenFocus),
        };
        return;
      }

      evenFocus = {
        anchor: parentPath,
        offset: 0,
      };
    }

    this.focus = { kind: FocusKind.Range, range: asUnevenPathRange(evenFocus) };
    return;
  }

  private tryMoveThroughLeaves(offset: -1 | 1, extend: boolean) {
    let currentPath: Path;
    if (this.focus.kind === FocusKind.Range) {
      currentPath = [...this.focus.range.tip];
    } else if (this.focus.kind === FocusKind.Location) {
      currentPath = [...this.focus.before];
      if (currentPath.length && offset === 1) {
        currentPath[currentPath.length - 1] -= 1;
      }
    } else {
      return unreachable(this.focus);
    }

    while (true) {
      if (!currentPath.length) {
        return;
      }
      const siblingPath = [...currentPath];
      siblingPath[siblingPath.length - 1] += offset;
      if (nodeGetByPath(this.doc.root, siblingPath)) {
        currentPath = siblingPath;
        break;
      }
      currentPath.pop();
    }

    while (true) {
      const currentNode = nodeGetByPath(this.doc.root, currentPath)!;
      if (currentNode.kind !== NodeKind.List || !currentNode.content.length) {
        break;
      }
      const childPath = [
        ...currentPath,
        offset === -1 ? currentNode.content.length - 1 : 0,
      ];
      if (!nodeGetByPath(this.doc.root, childPath)) {
        break;
      }
      currentPath = childPath;
    }

    this.focus = {
      kind: FocusKind.Range,
      range:
        extend && this.focus.kind === FocusKind.Range
          ? { anchor: this.focus.range.anchor, tip: currentPath }
          : { anchor: currentPath, tip: currentPath },
    };
  }

  private whileUnevenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (focusesAreEqual(this.focus, oldFocus)) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private untilEvenFocusChanges(cb: () => void) {
    let oldFocus = this.focus;
    while (true) {
      cb();
      if (focusesAreEqual(this.focus, oldFocus)) {
        // avoid infinite loop (if the uneven focus didn't change, it probably never will, so the even focus wont either)
        return;
      }
      if (
        this.focus.kind !== FocusKind.Range ||
        oldFocus.kind !== FocusKind.Range ||
        !evenPathRangesAreEqual(
          asEvenPathRange(this.focus.range),
          asEvenPathRange(oldFocus.range),
        )
      ) {
        return;
      }
      oldFocus = this.focus;
    }
  }

  private onUpdate() {
    const docChanged = this.doc !== this.lastDoc;

    if (this.mode === Mode.Normal && docChanged) {
      this.removeInvisibleNodes();
    }
    this.whileUnevenFocusChanges(() => this.normalizeFocus());
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.history = [];
      }
      this.history.push({
        doc: this.doc,
        focus: this.focus,
        parentFocuses: [...this.parentFocuses],
        insertState: this.insertState,
      });
    }
    this.lastMode = this.mode;

    if (docChanged) {
      this.updateDocText();
    }

    this.reportUpdate();

    this.lastDoc = this.doc;
  }

  private reportUpdate() {
    let doc = this.doc;
    if (this.insertState) {
      const result = this.getDocWithoutPlaceholdersNearCursor(
        this.doc,
        this.insertState.beforePos,
      );
      doc = getDocWithInsert(result.doc, {
        beforePos: result.cursorBeforePos,
        text: this.insertState.text,
      });
      doc = {
        ...doc,
        root: filterNodes(doc.root, (node) => !node.isPlaceholder).node,
      };
    }
    this._onUpdate({
      doc,
      focus: this.focus,
      mode: this.mode,
    });
  }

  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
    this.doc = {
      ...this.doc,
      root: filterNodes(this.doc.root, (node) => !node.isPlaceholder).node,
    };
    // HACK makeNodeValidTs makes replaces some single item lists by their only item.
    // This is the easiest way to make the focus valid again, even though it's not very clean.
    this.fixFocus();
  }

  private fixFocus() {
    if (this.focus.kind === FocusKind.Range) {
      this.focus = {
        kind: FocusKind.Range,
        range: {
          anchor: nodeTryGetDeepestByPath(
            this.doc.root,
            this.focus.range.anchor,
          ).path,
          tip: nodeTryGetDeepestByPath(this.doc.root, this.focus.range.tip)
            .path,
        },
      };
    } else if (this.focus.kind === FocusKind.Location) {
      // TODO it's not enough to use nodeTryGetDeepestByPath here because there might be no node at the before path (end of list)
    } else {
      return unreachable(this.focus);
    }
  }

  private normalizeFocus() {
    if (this.focus.kind !== FocusKind.Range) {
      return;
    }
    const evenFocus = asEvenPathRange(this.focus.range);
    if (evenFocus.offset !== 0) {
      return;
    }
    const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
    if (!focusedNode) {
      throw new Error("invalid focus");
    }
    if (
      focusedNode.kind !== NodeKind.List ||
      !focusedNode.equivalentToContent ||
      !focusedNode.content.length
    ) {
      return;
    }
    this.focus = {
      kind: FocusKind.Range,
      range: {
        anchor: [...evenFocus.anchor, 0],
        tip: [...evenFocus.anchor, focusedNode.content.length - 1],
      },
    };
  }

  private removeInvisibleNodes() {
    if (this.focus.kind !== FocusKind.Range) {
      // TODO FocusKind.Location probably needs support too
      return;
    }
    const anchorResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.range.anchor,
      offset: 0,
    });
    const tipResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.range.tip,
      offset: 0,
    });
    this.doc = anchorResult.doc;
    this.focus = {
      kind: FocusKind.Range,
      range: {
        anchor: anchorResult.focus.anchor,
        tip: tipResult.focus.anchor,
      },
    };
  }
}
