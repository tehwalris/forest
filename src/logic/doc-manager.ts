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
  ListNode,
  NodeKind,
  Path,
  UnevenPathRange,
} from "./interfaces";
import { memoize } from "./memoize";
import { docFromAst } from "./node-from-ts";
import { astFromTypescriptFileContent } from "./parse";
import {
  acceptPasteReplace,
  acceptPasteRoot,
  Clipboard,
  PasteReplaceArgs,
} from "./paste";
import {
  asEvenPathRange,
  asUnevenPathRange,
  evenPathRangesAreEqual,
  flipEvenPathRange,
  flipEvenPathRangeForward,
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
  nodeVisitDeepInRange,
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
  enableReduceToTip: boolean;
}

export const initialDocManagerPublicState: DocManagerPublicState = {
  doc: emptyDoc,
  focus: { anchor: [], offset: 0 },
  mode: Mode.Normal,
  enableReduceToTip: false,
};

export interface MinimalKeyboardEvent {
  key: string;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

function hasAltLike(
  ev: MinimalKeyboardEvent,
): ev is MinimalKeyboardEvent & ({ altKey: true } | { metaKey: true }) {
  return !!ev.altKey || !!ev.metaKey;
}

interface InsertHistoryEntry {
  doc: Doc;
  focus: UnevenPathRange;
  parentFocuses: EvenPathRange[];
  insertState: InsertState;
}

interface FocusHistoryEntry {
  focus: UnevenPathRange;
  enableReduceToTip: boolean;
}

export class DocManager {
  public readonly initialDoc: Doc;
  private focus: UnevenPathRange = { anchor: [], tip: [] };
  private parentFocuses: EvenPathRange[] = [];
  private insertHistory: InsertHistoryEntry[] = [];
  private focusHistory: FocusHistoryEntry[] = [];
  private focusRedoHistory: FocusHistoryEntry[] = [];
  private mode = Mode.Normal;
  private lastMode = this.mode;
  private lastDoc = emptyDoc;
  private lastFocus = this.focus;
  private insertState: InsertState | undefined;
  private enableReduceToTip = false;
  private nextEnableReduceToTip = false;
  private getDocWithoutPlaceholdersNearCursor = memoize(
    getDocWithoutPlaceholdersNearCursor,
  );
  private clipboard: Clipboard | undefined;

  constructor(
    private doc: Doc,
    private _onUpdate: (publicState: DocManagerPublicState) => void,
  ) {
    this.initialDoc = doc;
  }

  private static copyDocManagerFields(source: DocManager, target: DocManager) {
    for (const [k, v] of Object.entries(source)) {
      if (typeof v === "function") {
        continue;
      }
      if (Array.isArray(v)) {
        (target as any)[k] = [...v];
      } else {
        (target as any)[k] = v;
      }
    }
  }

  clone(): DocManager {
    const other = new DocManager(this.initialDoc, this.onUpdate);
    DocManager.copyDocManagerFields(this, other);
    return other;
  }

  fillFromOther(other: DocManager) {
    DocManager.copyDocManagerFields(other, this);
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
      if (ev.key === "i") {
        if (this.isFocusOnEmptyListContent()) {
          this.tryMoveOutOfList(() => true);
          this.tryInsertIntoEmptyList();
        } else {
          this.tryInsertBefore();
        }
      } else if (ev.key === "a") {
        if (this.isFocusOnEmptyListContent()) {
          this.tryMoveOutOfList(() => true);
          this.tryInsertIntoEmptyList();
        } else {
          this.tryInsertAfter();
        }
      } else if (ev.key === "d") {
        if (this.isFocusOnEmptyListContent()) {
          return;
        }

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
      } else if (ev.key === "l" && !hasAltLike(ev)) {
        this.flipFocusForward();
        this.tryMoveThroughLeaves(1, false);
      } else if (ev.key === "L" && !ev.ctrlKey) {
        this.flipFocusForward();
        this.tryMoveThroughLeaves(1, true);
        this.nextEnableReduceToTip = true;
      } else if (ev.key === "h" && !hasAltLike(ev)) {
        this.flipFocusBackward();
        this.tryMoveThroughLeaves(-1, false);
      } else if (ev.key === "H" && !ev.ctrlKey) {
        this.flipFocusBackward();
        this.tryMoveThroughLeaves(-1, true);
        this.nextEnableReduceToTip = true;
      } else if (ev.key === "k") {
        if (this.isFocusOnEmptyListContent()) {
          this.tryMoveOutOfList(() => true);
          this.onUpdate();
          return;
        }

        const oldFocus = this.focus;

        this.tryMoveToParent();
        const nonDelimitedParentFocus = this.focus;
        this.focus = oldFocus;

        this.tryMoveOutOfList(() => true);
        const delimitedParentFocus = this.focus;
        this.focus = oldFocus;

        const choiceBoolean =
          asEvenPathRange(nonDelimitedParentFocus).anchor.length >
          asEvenPathRange(delimitedParentFocus).anchor.length;
        const chosenFocus = choiceBoolean
          ? nonDelimitedParentFocus
          : delimitedParentFocus;
        const nonChosenFocus = choiceBoolean
          ? delimitedParentFocus
          : nonDelimitedParentFocus;

        this.focus = chosenFocus;
        this.normalizeFocusIn();
        if (
          evenPathRangesAreEqual(
            flipEvenPathRangeForward(asEvenPathRange(this.focus)),
            flipEvenPathRangeForward(asEvenPathRange(oldFocus)),
          )
        ) {
          this.focus = nonChosenFocus;
        }
      } else if (ev.key === "K") {
        this.tryMoveOutOfList(() => true);
      } else if ([")", "]", "}", ">"].includes(ev.key)) {
        this.tryMoveOutOfList((node) => node.delimiters[1] === ev.key);
      } else if (ev.key === "j") {
        this.tryMoveIntoList(() => true);
      } else if (["(", "[", "{", "<"].includes(ev.key)) {
        this.tryMoveIntoList((node) => node.delimiters[0] === ev.key);
      } else if (ev.key === " ") {
        ev.preventDefault?.();
        if (this.enableReduceToTip) {
          this.focus = asUnevenPathRange({
            anchor: getPathToTip(asEvenPathRange(this.focus)),
            offset: 0,
          });
        }
      } else if (ev.key === "c") {
        if (this.isFocusOnEmptyListContent()) {
          return;
        }

        const evenFocus = asEvenPathRange(
          whileUnevenFocusChanges(this.focus, (focus) =>
            normalizeFocusOutOnce(this.doc.root, focus),
          ),
        );
        if (evenFocus.offset === 0) {
          const node = nodeGetByPath(this.doc.root, evenFocus.anchor);
          this.clipboard = node && { node: node, isPartialCopy: false };
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
            node: {
              ...oldParent,
              content: oldParent.content.slice(
                selectedRange[0],
                selectedRange[1] + 1,
              ),
            },
            isPartialCopy: true,
          };
        }
        if (
          this.clipboard?.node.kind === NodeKind.List &&
          this.clipboard.node.listKind === ListKind.File &&
          this.clipboard.node.content.length === 1
        ) {
          this.clipboard = {
            node: this.clipboard.node.content[0],
            isPartialCopy: false,
          };
        }
        if (
          this.clipboard?.node.kind === NodeKind.List &&
          this.clipboard.node.listKind === ListKind.TsNodeStruct &&
          this.clipboard.node.tsNode?.kind === ts.SyntaxKind.ExpressionStatement
        ) {
          this.clipboard = {
            node: getStructContent(this.clipboard.node, ["expression"], [])
              .expression,
            isPartialCopy: false,
          };
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
          let oldParentNode = nodeGetByPath(this.doc.root, parentPath);
          if (oldParentNode?.kind !== NodeKind.List) {
            throw new Error("expected parent to exist and be a list");
          }

          if (this.isFocusOnEmptyListContent()) {
            oldParentNode = {
              ...oldParentNode,
              content: [
                {
                  kind: NodeKind.Token,
                  pos: -1,
                  end: -1,
                  isPlaceholder: true,
                  tsNode: ts.factory.createIdentifier("placeholder"),
                },
              ],
            };
          }

          let grandparentInfo: PasteReplaceArgs["parent"];
          if (evenFocus.anchor.length >= 2) {
            const grandparentPath = evenFocus.anchor.slice(0, -2);
            const oldGrandparentNode = nodeGetByPath(
              this.doc.root,
              grandparentPath,
            );
            if (oldGrandparentNode?.kind !== NodeKind.List) {
              throw new Error("expected grandparent to exist and be a list");
            }
            grandparentInfo = {
              node: oldGrandparentNode,
              childIndex: parentPath[parentPath.length - 1],
            };
          }

          const firstIndex = evenFocus.anchor[evenFocus.anchor.length - 1];
          const newParentNode = acceptPasteReplace({
            node: oldParentNode,
            parent: grandparentInfo,
            firstIndex,
            lastIndex: firstIndex + evenFocus.offset,
            clipboard: this.clipboard.node,
            isPartialCopy: this.clipboard.isPartialCopy,
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
          const historyEntry = this.focusHistory.pop()!;
          if (
            evenPathRangesAreEqual(
              asEvenPathRange(historyEntry.focus),
              asEvenPathRange(this.focus),
            )
          ) {
            continue;
          }
          this.focusRedoHistory.push({
            focus: this.focus,
            enableReduceToTip: this.enableReduceToTip,
          });
          this.focus = historyEntry.focus;
          this.nextEnableReduceToTip = historyEntry.enableReduceToTip;
          break;
        }
      } else if (ev.key === "Z") {
        while (this.focusRedoHistory.length) {
          const historyEntry = this.focusRedoHistory.pop()!;
          if (
            evenPathRangesAreEqual(
              asEvenPathRange(historyEntry.focus),
              asEvenPathRange(this.focus),
            )
          ) {
            continue;
          }
          this.focusHistory.push({
            focus: this.focus,
            enableReduceToTip: this.enableReduceToTip,
          });
          this.focus = historyEntry.focus;
          this.nextEnableReduceToTip = historyEntry.enableReduceToTip;
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
    if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "h" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      if (!this.isFocusOnEmptyListContent()) {
        const target = this.getFocusSkippingDelimitedLists().anchor;
        if (nodeGetByPath(this.doc.root, target)) {
          this.focus = asUnevenPathRange({
            anchor: target,
            offset: 0,
          });
          this.onUpdate();
        }
      }
    } else if (this.mode === Mode.Normal && ev.key === "H" && ev.ctrlKey) {
      ev.preventDefault?.();
      if (asEvenPathRange(this.focus).offset !== 0) {
        this.flipFocusForward();
        this.tryMoveThroughLeaves(-1, true);
        this.nextEnableReduceToTip = true;
      }
      this.onUpdate();
    } else if (
      this.mode === Mode.Normal &&
      ev.key.toLowerCase() === "l" &&
      hasAltLike(ev)
    ) {
      ev.preventDefault?.();
      if (!this.isFocusOnEmptyListContent()) {
        const target = getPathToTip(this.getFocusSkippingDelimitedLists());
        if (nodeGetByPath(this.doc.root, target)) {
          this.focus = asUnevenPathRange({
            anchor: target,
            offset: 0,
          });
          this.onUpdate();
        }
      }
    } else if (this.mode === Mode.Normal && ev.key === "L" && ev.ctrlKey) {
      ev.preventDefault?.();
      if (asEvenPathRange(this.focus).offset !== 0) {
        this.flipFocusBackward();
        this.tryMoveThroughLeaves(1, true);
        this.nextEnableReduceToTip = true;
      }
      this.onUpdate();
    } else if (
      (this.mode === Mode.InsertBefore || this.mode === Mode.InsertAfter) &&
      ev.key === "Escape"
    ) {
      const finalStuff = () => {
        this.mode = Mode.Normal;
        this.insertHistory = [];
        this.parentFocuses = [];
        this.insertState = undefined;
        this.removeInvisibleNodes();
        this.onUpdate();
      };

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

          const mapPath = (p: Path) =>
            placeholderRemoval.pathMapper.mapRough(
              checkedInsertion.pathMapper.mapRough(
                initialPlaceholderInsertion.mapOldToWithoutAdjacent(p),
              ),
            );
          const mappedOldFocus = {
            anchor: mapPath(this.focus.anchor),
            tip: mapPath(this.focus.tip),
          };
          this.focus = mappedOldFocus;

          if (checkedInsertion.insertedRange) {
            this.focus = checkedInsertion.insertedRange;

            finalStuff();
            // HACK this has to happen after onUpdate (which is in finalStuff), because that clears focusHistory
            this.focusHistory.push({
              focus: mappedOldFocus,
              enableReduceToTip: this.enableReduceToTip,
            });
            return;
          }
        } catch (err) {
          console.warn("insertion would make doc invalid", err);
          return;
        }
      }

      finalStuff();
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

  private tryMoveOutOfList(isMatch: (node: ListNode) => boolean) {
    let evenFocus = asEvenPathRange(this.focus);
    while (evenFocus.anchor.length >= 2) {
      evenFocus = {
        anchor: evenFocus.anchor.slice(0, -1),
        offset: 0,
      };
      const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
      if (
        focusedNode?.kind === NodeKind.List &&
        !focusedNode.equivalentToContent &&
        isMatch(focusedNode)
      ) {
        this.focus = asUnevenPathRange(evenFocus);
        return;
      }
    }
  }

  private tryMoveIntoList(isMatch: (node: ListNode) => boolean) {
    let listPath: Path | undefined;
    nodeVisitDeepInRange(
      this.doc.root,
      asEvenPathRange(this.focus),
      (node, path) => {
        if (listPath) {
          return;
        }
        if (
          node.kind === NodeKind.List &&
          !node.equivalentToContent &&
          isMatch(node)
        ) {
          listPath = path;
        }
      },
    );
    if (!listPath) {
      return;
    }

    const listNode = nodeGetByPath(this.doc.root, listPath);
    if (listNode?.kind !== NodeKind.List) {
      throw new Error("unreachable");
    }
    this.focus = asUnevenPathRange({
      anchor: [...listPath, 0],
      offset: Math.max(0, listNode.content.length - 1),
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

  private getFocusSkippingDelimitedLists(): EvenPathRange {
    let evenFocus = asEvenPathRange(this.focus);
    if (evenFocus.offset < 0) {
      evenFocus = flipEvenPathRange(evenFocus);
    }
    while (!evenFocus.offset) {
      const focusedNode = nodeGetByPath(this.doc.root, evenFocus.anchor);
      if (!focusedNode) {
        throw new Error("invalid focus");
      }
      if (focusedNode.kind !== NodeKind.List) {
        break;
      }
      evenFocus = {
        anchor: [...evenFocus.anchor, 0],
        offset: focusedNode.content.length - 1,
      };
    }
    return evenFocus;
  }

  private tryMoveThroughLeaves(offset: -1 | 1, extend: boolean) {
    this.focus = untilEvenFocusChanges(this.focus, (focus) =>
      tryMoveThroughLeavesOnce(this.doc.root, focus, offset, extend),
    );
  }

  private normalizeFocusIn() {
    if (this.isFocusOnEmptyListContent()) {
      return;
    }
    this.focus = whileUnevenFocusChanges(this.focus, (focus) =>
      normalizeFocusInOnce(this.doc.root, focus),
    );
  }

  private isFocusOnEmptyListContent(): boolean {
    const evenFocus = asEvenPathRange(this.focus);

    if (!evenFocus.anchor.length) {
      return false;
    }
    const parentNode = nodeGetByPath(
      this.doc.root,
      evenFocus.anchor.slice(0, -1),
    );
    if (!parentNode) {
      throw new Error("invalid focus");
    }
    return (
      parentNode.kind === NodeKind.List &&
      !parentNode.content.length &&
      evenFocus.anchor[evenFocus.anchor.length - 1] === 0 &&
      evenFocus.offset === 0
    );
  }

  private tryInsertIntoEmptyList() {
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
  }

  private tryInsertBefore() {
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
  }

  private tryInsertAfter() {
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
  }

  private onUpdate() {
    const docChanged = this.doc !== this.lastDoc;

    if (this.mode === Mode.Normal && docChanged) {
      this.removeInvisibleNodes();
    }

    this.focus = asUnevenPathRange(asEvenPathRange(this.focus));
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
        asEvenPathRange(this.focusHistory[this.focusHistory.length - 1].focus),
        asEvenPathRange(this.focus),
      )
    ) {
      this.focusHistory.push({
        focus: this.focus,
        enableReduceToTip: this.enableReduceToTip,
      });
    }

    if (
      this.nextEnableReduceToTip &&
      (!evenPathRangesAreEqual(
        flipEvenPathRangeForward(asEvenPathRange(this.focus)),
        flipEvenPathRangeForward(asEvenPathRange(this.lastFocus)),
      ) ||
        this.enableReduceToTip)
    ) {
      this.enableReduceToTip = this.nextEnableReduceToTip;
    } else {
      this.enableReduceToTip = false;
    }
    this.nextEnableReduceToTip = false;
    this.lastFocus = this.focus;

    this.lastDoc = this.doc;

    this.reportUpdate();
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
      enableReduceToTip: this.enableReduceToTip,
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

  private flipFocusForward() {
    if (asEvenPathRange(this.focus).offset < 0) {
      this.focus = flipUnevenPathRange(this.focus);
    }
  }

  private flipFocusBackward() {
    if (asEvenPathRange(this.focus).offset > 0) {
      this.focus = flipUnevenPathRange(this.focus);
    }
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
