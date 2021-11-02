import ts from "typescript";
import { checkInsertion } from "./check-insertion";
import { docMapRoot, emptyDoc } from "./doc-utils";
import {
  normalizeFocusInOnce,
  normalizeFocusOutOnce,
  tryMoveThroughLeavesOnce,
  untilEvenFocusChanges,
  whileUnevenFocusChanges,
} from "./focus";
import {
  Doc,
  EvenPathRange,
  InsertState,
  ListKind,
  Node,
  NodeKind,
  Path,
  UnevenPathRange,
} from "./interfaces";
import { memoize } from "./memoize";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import { acceptPasteReplace, acceptPasteRoot } from "./paste";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqual,
  flipEvenPathRange,
  flipUnevenPathRange,
  getPathToTip,
} from "./path-utils";
import {
  getDocWithAllPlaceholders,
  getDocWithoutPlaceholdersNearCursor,
} from "./placeholders";
import { prettyPrintTsSourceFile } from "./print";
import { getStructContent } from "./struct";
import { getDocWithInsert } from "./text";
import {
  nodeGetByPath,
  nodeMapAtPath,
  nodeSetByPath,
  nodeTryGetDeepestByPath,
  nodeVisitDeep,
} from "./tree-utils/access";
import { filterNodes } from "./tree-utils/filter";
import { withoutInvisibleNodes } from "./without-invisible";

export enum Mode {
  Normal,
  InsertBefore,
  InsertAfter,
}

export interface DocManagerPublicState {
  doc: Doc;
  focus: EvenPathRange;
  mode: Mode;
}

export const initialDocManagerPublicState: DocManagerPublicState = {
  doc: emptyDoc,
  focus: { anchor: [], offset: 0 },
  mode: Mode.Normal,
};

export interface MinimalKeyboardEvent {
  key: string;
  altKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export class DocManager {
  public readonly initialDoc: Doc;
  private focus: UnevenPathRange = { anchor: [], tip: [] };
  private parentFocuses: EvenPathRange[] = [];
  private insertHistory: {
    doc: Doc;
    focus: UnevenPathRange;
    parentFocuses: EvenPathRange[];
    insertState: InsertState;
  }[] = [];
  private focusHistory: UnevenPathRange[] = [];
  private focusRedoHistory: UnevenPathRange[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private lastDoc = emptyDoc;
  private insertState: InsertState | undefined;
  private getDocWithoutPlaceholdersNearCursor = memoize(
    getDocWithoutPlaceholdersNearCursor,
  );
  private clipboard: Node | undefined;

  constructor(
    private doc: Doc,
    private _onUpdate: (publicState: DocManagerPublicState) => void,
  ) {
    this.initialDoc = doc;
  }

  forceUpdate() {
    if (this.mode !== Mode.Normal) {
      throw new Error("forceUpdate can only be called in normal mode");
    }
    this.onUpdate();
    this.insertHistory = [];
  }

  disableUpdates() {
    this._onUpdate = () => {};
  }

  onKeyPress = (ev: MinimalKeyboardEvent) => {
    if (this.mode === Mode.Normal) {
      if (ev.key === "Enter") {
        const evenFocus = asEvenPathRange(this.focus);
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
      } else if (ev.key === "i") {
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const firstFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);

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
        let evenFocus = asEvenPathRange(this.focus);
        if (!evenFocus.anchor.length) {
          return;
        }
        if (evenFocus.offset > 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        const lastFocusedPath = evenFocus.anchor;
        evenFocus = flipEvenPathRange(evenFocus);
        this.focus = asUnevenPathRange(evenFocus);

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
        const evenFocus = asEvenPathRange(this.focus);
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
        this.focus = asUnevenPathRange({
          anchor:
            newFocusIndex === undefined
              ? forwardFocus.anchor.slice(0, -1)
              : [...forwardFocus.anchor.slice(0, -1), newFocusIndex],
          offset: 0,
        });
      } else if (ev.key === "l") {
        this.tryMoveThroughLeaves(1, false);
      } else if (ev.key === "L") {
        this.tryMoveThroughLeaves(1, true);
      } else if (ev.key === "h") {
        this.tryMoveThroughLeaves(-1, false);
      } else if (ev.key === "H") {
        this.tryMoveThroughLeaves(-1, true);
      } else if (ev.key === "k") {
        this.tryMoveOutOfList();
      } else if (ev.key === "K") {
        this.tryMoveToParent();
      } else if (ev.key === "j") {
        this.tryMoveIntoList();
      } else if (ev.key === ";") {
        this.focus = asUnevenPathRange({
          anchor: getPathToTip(asEvenPathRange(this.focus)),
          offset: 0,
        });
      } else if (ev.key === "c") {
        const evenFocus = asEvenPathRange(
          whileUnevenFocusChanges(this.focus, (focus) =>
            normalizeFocusOutOnce(this.doc.root, focus),
          ),
        );
        if (evenFocus.offset === 0) {
          this.clipboard = nodeGetByPath(this.doc.root, evenFocus.anchor);
        } else {
          if (!evenFocus.anchor.length) {
            throw new Error("invalid focus");
          }
          const oldParent = nodeGetByPath(
            this.doc.root,
            evenFocus.anchor.slice(0, -1),
          );
          if (oldParent?.kind !== NodeKind.List) {
            throw new Error("oldParent must be a list");
          }
          if (oldParent.structKeys) {
            console.warn(
              "can not copy from non-list node",
              this.focus,
              evenFocus,
            );
            return;
          }
          let selectedRange = [
            evenFocus.anchor[evenFocus.anchor.length - 1],
            evenFocus.anchor[evenFocus.anchor.length - 1] + evenFocus.offset,
          ];
          if (selectedRange[0] > selectedRange[1]) {
            selectedRange = [selectedRange[1], selectedRange[0]];
          }
          this.clipboard = {
            ...oldParent,
            content: oldParent.content.slice(
              selectedRange[0],
              selectedRange[1] + 1,
            ),
          };
        }
        if (
          this.clipboard?.kind === NodeKind.List &&
          this.clipboard.listKind === ListKind.File &&
          this.clipboard.content.length === 1
        ) {
          this.clipboard = this.clipboard.content[0];
        }
        if (
          this.clipboard?.kind === NodeKind.List &&
          this.clipboard.listKind === ListKind.TsNodeStruct &&
          this.clipboard.tsNode?.kind === ts.SyntaxKind.ExpressionStatement
        ) {
          this.clipboard = getStructContent(
            this.clipboard,
            ["expression"],
            [],
          ).expression;
        }
      } else if (ev.key === "p") {
        if (!this.clipboard) {
          return;
        }
        let evenFocus = asEvenPathRange(
          whileUnevenFocusChanges(this.focus, (focus) =>
            normalizeFocusOutOnce(this.doc.root, focus),
          ),
        );
        if (evenFocus.offset < 0) {
          evenFocus = flipEvenPathRange(evenFocus);
        }
        if (evenFocus.anchor.length) {
          const parentPath = evenFocus.anchor.slice(0, -1);
          const oldParentNode = nodeGetByPath(this.doc.root, parentPath);
          if (oldParentNode?.kind !== NodeKind.List) {
            throw new Error("expected parent to exist and be a list");
          }
          const firstIndex = evenFocus.anchor[evenFocus.anchor.length - 1];
          const newParentNode = acceptPasteReplace({
            node: oldParentNode,
            firstIndex,
            lastIndex: firstIndex + evenFocus.offset,
            clipboard: this.clipboard,
          });
          if (!newParentNode) {
            return;
          }
          this.doc = docMapRoot(this.doc, (root) =>
            nodeSetByPath(root, parentPath, newParentNode),
          );
        } else {
          const newRoot = acceptPasteRoot(this.clipboard);
          if (!newRoot) {
            return;
          }
          this.doc = { ...this.doc, root: newRoot };
        }
      } else if (ev.key === "o") {
        const tipPath = getPathToTip(asEvenPathRange(this.focus));
        console.log({
          doc: this.doc,
          focus: this.focus,
          tip: nodeGetByPath(this.doc.root, tipPath),
          tipPath,
          insertState: this.insertState,
        });
      } else if (ev.key === "z") {
        while (this.focusHistory.length) {
          const oldFocus = this.focusHistory.pop()!;
          if (
            evenPathRangesAreEqual(
              asEvenPathRange(oldFocus),
              asEvenPathRange(this.focus),
            )
          ) {
            continue;
          }
          this.focusRedoHistory.push(this.focus);
          this.focus = oldFocus;
          break;
        }
      } else if (ev.key === "Z") {
        while (this.focusRedoHistory.length) {
          const oldFocus = this.focusRedoHistory.pop()!;
          if (
            evenPathRangesAreEqual(
              asEvenPathRange(oldFocus),
              asEvenPathRange(this.focus),
            )
          ) {
            continue;
          }
          this.focusHistory.push(this.focus);
          this.focus = oldFocus;
          break;
        }
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
      this.focus = flipUnevenPathRange(this.focus);
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }

      if (this.insertHistory.length > 1) {
        try {
          const initialPlaceholderInsertion =
            getDocWithoutPlaceholdersNearCursor(
              this.doc,
              this.insertState.beforePos,
            );

          const astWithInsertBeforeFormatting = astFromTypescriptFileContent(
            getDocWithInsert(initialPlaceholderInsertion.doc, {
              text: this.insertState.text,
              beforePos: initialPlaceholderInsertion.cursorBeforePos,
            }).text,
          );
          if (astWithInsertBeforeFormatting.parseDiagnostics.length) {
            console.warn(
              "file has syntax errors",
              astWithInsertBeforeFormatting.parseDiagnostics,
              astWithInsertBeforeFormatting.text,
            );
            return;
          }

          const docWithInsert = docFromAst(
            astFromTypescriptFileContent(
              prettyPrintTsSourceFile(astWithInsertBeforeFormatting),
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

          if (checkedInsertion.insertedRange) {
            this.focus = checkedInsertion.insertedRange;
          } else {
            const mapPath = (p: Path) =>
              placeholderRemoval.pathMapper.mapRough(
                checkedInsertion.pathMapper.mapRough(
                  initialPlaceholderInsertion.mapOldToWithoutAdjacent(p),
                ),
              );
            this.focus = {
              anchor: mapPath(this.focus.anchor),
              tip: mapPath(this.focus.tip),
            };
          }
        } catch (err) {
          console.warn("insertion would make doc invalid", err);
          return;
        }
      }

      this.mode = Mode.Normal;
      this.insertHistory = [];
      this.parentFocuses = [];
      this.insertState = undefined;
      this.removeInvisibleNodes();
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Backspace"
    ) {
      if (this.insertHistory.length < 2) {
        return;
      }
      this.insertHistory.pop();
      const old = this.insertHistory.pop()!;
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
    let evenFocus = asEvenPathRange(this.focus);
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
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }
    }
  }

  private tryMoveIntoList() {
    const evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset !== 0) {
      return;
    }
    const listPath = evenFocus.anchor;
    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List || !listNode.content.length) {
      return;
    }
    this.focus = asUnevenPathRange({
      anchor: [...listPath, 0],
      offset: listNode.content.length - 1,
    });
  }

  private tryMoveToParent() {
    let evenFocus = asEvenPathRange(this.focus);
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
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }

      evenFocus = {
        anchor: parentPath,
        offset: 0,
      };
    }

    this.focus = asUnevenPathRange(evenFocus);
    return;
  }

  private tryMoveThroughLeaves(offset: -1 | 1, extend: boolean) {
    this.focus = untilEvenFocusChanges(this.focus, (focus) =>
      tryMoveThroughLeavesOnce(this.doc.root, focus, offset, extend),
    );
  }

  private normalizeFocusIn() {
    this.focus = whileUnevenFocusChanges(this.focus, (focus) =>
      normalizeFocusInOnce(this.doc.root, focus),
    );
  }

  private onUpdate() {
    const docChanged = this.doc !== this.lastDoc;

    if (this.mode === Mode.Normal && docChanged) {
      this.removeInvisibleNodes();
    }
    this.normalizeFocusIn();
    if (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) {
      if (!this.insertState) {
        throw new Error("this.insertState was undefined in insert mode");
      }
      if (this.lastMode !== this.mode) {
        this.insertHistory = [];
      }
      this.insertHistory.push({
        doc: this.doc,
        focus: this.focus,
        parentFocuses: [...this.parentFocuses],
        insertState: this.insertState,
      });
    }
    this.lastMode = this.mode;

    if (docChanged) {
      this.updateDocText();
      this.focusHistory = [];
      this.focusRedoHistory = [];
    }

    if (
      !this.focusHistory.length ||
      !evenPathRangesAreEqual(
        asEvenPathRange(this.focusHistory[this.focusHistory.length - 1]),
        asEvenPathRange(this.focus),
      )
    ) {
      this.focusHistory.push(this.focus);
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
    }
    this._onUpdate({
      doc,
      focus: asEvenPathRange(this.focus),
      mode: this.mode,
    });
  }

  private updateDocText() {
    this.doc = getDocWithAllPlaceholders(this.doc).doc;
    // HACK makeNodeValidTs makes replaces some single item lists by their only item.
    // This is the easiest way to make the focus valid again, even though it's not very clean.
    this.fixFocus();
  }

  private fixFocus() {
    this.focus = {
      anchor: nodeTryGetDeepestByPath(this.doc.root, this.focus.anchor).path,
      tip: nodeTryGetDeepestByPath(this.doc.root, this.focus.tip).path,
    };
  }

  private removeInvisibleNodes() {
    const anchorResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.anchor,
      offset: 0,
    });
    const tipResult = withoutInvisibleNodes(this.doc, {
      anchor: this.focus.tip,
      offset: 0,
    });
    this.doc = anchorResult.doc;
    this.focus = {
      anchor: anchorResult.focus.anchor,
      tip: tipResult.focus.anchor,
    };
  }
}
