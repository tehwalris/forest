import * as React from "react";
import * as R from "ramda";
import TypescriptProvider, { FileNode } from "../logic/providers/typescript";
import TreeDisplay from "./tree/tree-display";
import { Path } from "../logic/tree/base";
import { Node, Flag, FlagSet } from "../logic/tree/node";
import { Action, InputKind, ActionSet } from "../logic/tree/action";
import { ActionFiller } from "./tree/action-filler";
import * as ts from "typescript";
import CodeDisplay from "./code-display";
import {
  buildDisplayTree,
  DisplayNode,
  DisplayPath,
  nodesFromDisplayNode,
  buildNavTree,
  buildDivetreeDisplayTree,
} from "../logic/tree/display";
import * as prettier from "prettier";
import { NavTree } from "divetree-react";
interface PrettyPrintResult {
  node: FileNode;
  text: string;
}
interface State {
  selection: DisplayPath;
  deepestSelection: DisplayPath;
  inProgressAction?: {
    target: () => Path; // EXTREME HACK
    action: Action<any>;
  };
  filePath: string;
  tree: Node<{}>;
  disablePrettier: boolean;
  disableFolding: boolean;
  prettyPrintResult?: PrettyPrintResult;
}
interface SavedState {
  filePath: string;
  selection: DisplayPath;
}
const PRETTIER_OPTIONS = {
  parser: "typescript" as "typescript",
  printWidth: 80,
};
const INITIAL_FILE: string = "temp/fizz-buzz/index.ts";
const styles = {
  wrapper: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    position: "fixed",
    top: 0,
    left: 0,
  },
  leftPanel: {
    height: "100%",
    overflow: "scroll",
    width: "50%",
  },
  rightPanel: {
    height: "100%",
    overflow: "scroll",
    width: "50%",
  },
};

export default class Home extends React.Component<{}, State> {
  typescriptProvider = new TypescriptProvider();
  state: State = this.loadState();
  loadState() {
    const output: State = {
      selection: [],
      deepestSelection: [],
      filePath: INITIAL_FILE,
      tree: undefined as any,
      disablePrettier: false,
      disableFolding: false,
    };
    const _loaded = window.localStorage.getItem("editorState");
    if (_loaded) {
      const loaded: SavedState = JSON.parse(_loaded);
      output.filePath = loaded.filePath;
      output.selection = loaded.selection;
    }
    output.tree = this.typescriptProvider.loadTree(output.filePath);
    return output;
  }
  saveState() {
    const { selection, filePath } = this.state;
    const toSave: SavedState = { selection, filePath };
    window.localStorage.setItem("editorState", JSON.stringify(toSave));
  }
  componentWillMount() {
    (window as any).openFile = this.openFile.bind(this);
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    this.setState({ prettyPrintResult: this.prettyPrint() });
  }
  componentWillUpdate(nextProps: {}, nextState: State) {
    if (nextState.tree !== this.state.tree) {
      const prettyPrintResult = this.prettyPrint(nextState);
      this.setState({ prettyPrintResult }, () => this.saveState());
      if (prettyPrintResult) {
        this.typescriptProvider.saveFile(
          nextState.filePath,
          prettyPrintResult.node,
        );
      }
    }
  }
  openFile(filePath: string) {
    this.setState({
      filePath,
      tree: this.typescriptProvider.loadTree(filePath),
    });
  }
  getDeepestPossibleByDisplayPath(
    path: DisplayPath,
    parent: DisplayNode,
  ): DisplayNode {
    if (path.length) {
      const childNode = parent.children[path[0]];
      if (childNode) {
        return this.getDeepestPossibleByDisplayPath(path.slice(1), childNode);
      }
    }
    return parent;
  }
  onKeyDown(e: KeyboardEvent) {
    if ((e as any).path.length > 4) {
      // HACK
      console.log("ignoring keystroke");
      return;
    }
    const { selection } = this.state;
    this.onSimulatedKey(e.key, selection);
  }
  onSimulatedKey = (key: string, selection: DisplayPath) => {
    const { tree } = this.state;
    const current = this.getDeepestPossibleByDisplayPath(
      selection,
      buildDisplayTree(tree),
    );
    const nodes = nodesFromDisplayNode(current);
    const tryAction = (actionKey: keyof ActionSet<any>) => () => {
      for (const { node, path } of nodes) {
        const action = node.actions[actionKey];
        if (action) {
          this.handleAction(action, () => path);
          break;
        }
      }
    };
    const parentNodes = current.parent
      ? nodesFromDisplayNode(current.parent)
      : [];
    const tryDeleteChild = () => {
      const deleteFrom = R.tail(R.reverse([...parentNodes, ...nodes]));
      let toDelete = R.last(nodes)!;
      for (const _e of deleteFrom) {
        const action = _e.node.actions.deleteChild;
        if (action) {
          this.handleAction(action, () => _e.path, R.last(toDelete.path)!);
          break;
        }
        toDelete = _e;
      }
    };
    const handlers: { [key: string]: (() => void) | undefined } = {
      h: () => this.onShortcutLeft(),
      l: () => this.onShortcutRight(),
      k: () => this.onShortcutUp(),
      j: () => this.onShortcutDown(),
      Enter: () => this.onShortcutSelect(),
      Escape: () => this.setState({ inProgressAction: undefined }),
      r: () => this.tryReload(),
      R: () => this.setState({ disablePrettier: true }),
      F: () => this.setState({ disableFolding: !this.state.disableFolding }),
      p: tryAction("prepend"),
      a: tryAction("append"),
      s: tryAction("setFromString"),
      v: tryAction("setVariant"),
      t: tryAction("toggle"),
      i: tryAction("insertByKey"),
      d: tryAction("deleteByKey"),
      x: tryDeleteChild,
      f: () => this.editFlags(nodes),
    };
    const handler = handlers[key];
    if (handler) {
      handler();
    }
  };
  onShortcutLeft() {
    const { selection } = this.state;
    if (selection.length) {
      this.setState({ selection: selection.slice(0, -1) });
    }
  }
  onShortcutRight() {
    const { selection, deepestSelection, tree } = this.state;
    const current = this.getDeepestPossibleByDisplayPath(
      selection,
      buildDisplayTree(tree),
    );
    let bestChild = current.children[0];
    const isPrefix = <T extends {}>(prefix: T[], whole: T[]) =>
      whole.length > selection.length && prefix.every((e, i) => e === whole[i]);
    if (isPrefix(selection, deepestSelection)) {
      bestChild =
        current.children[deepestSelection[selection.length]] || bestChild;
    }
    if (bestChild) {
      const newSelection = bestChild.displayPath;
      this.setState({
        selection: newSelection,
        deepestSelection: isPrefix(newSelection, deepestSelection)
          ? deepestSelection
          : newSelection,
      });
    }
  }
  onShortcutUp() {
    const { selection, tree } = this.state;
    const parent = this.getDeepestPossibleByDisplayPath(
      selection.slice(0, -1),
      buildDisplayTree(tree),
    );
    const ownIndex = selection[selection.length - 1];
    if (ownIndex > 0) {
      const childAbove = parent.children[ownIndex - 1];
      this.setState({
        selection: childAbove.displayPath,
        deepestSelection: childAbove.displayPath,
      });
    }
  }
  onShortcutDown() {
    const { selection, tree } = this.state;
    const parent = this.getDeepestPossibleByDisplayPath(
      selection.slice(0, -1),
      buildDisplayTree(tree),
    );
    const ownIndex = selection[selection.length - 1];
    if (ownIndex < parent.children.length - 1) {
      const childBelow = parent.children[ownIndex + 1];
      this.setState({
        selection: childBelow.displayPath,
        deepestSelection: childBelow.displayPath,
      });
    }
  }
  onShortcutSelect() {
    const { selection, tree } = this.state;
    const current = this.getDeepestPossibleByDisplayPath(
      selection,
      buildDisplayTree(tree),
    );
    if (current.displayPath.length === selection.length) {
      console.log(current);
    }
  }
  focusActionFiller() {
    (document.querySelector(".actionFiller input") as HTMLInputElement).focus();
  }
  handleAction(
    action: Action<any>,
    target: () => Path,
    childActionArgument?: string,
  ) {
    if (action.inputKind === InputKind.None) {
      this.updateNode(target(), action.apply());
    } else if (action.inputKind === InputKind.Child) {
      if (!childActionArgument) {
        throw new Error("Expected childActionArgument");
      }
      this.updateNode(target(), action.apply(childActionArgument));
    } else {
      this.setState({
        inProgressAction: { target, action },
      });
      setImmediate(() => this.focusActionFiller());
    }
  }
  editFlags(nodes: { node: Node<{}>; path: Path }[]) {
    interface Option {
      label: string;
      apply: (flags: FlagSet) => FlagSet;
      node: Node<{}>;
      path: Path;
    }
    const options = R.chain(
      R.pipe(
        ({ node, path }: { node: Node<{}>; path: Path }) =>
          R.mapObjIndexed((v: Flag, k) => ({ node, path, v, k }), node.flags),
        R.values,
        R.chain(({ k, v, node, path }): Option[] => {
          if (typeof v === "boolean") {
            return [
              {
                label: `${k} (${v ? "remove" : "add"})`,
                apply: R.assoc(k, !v),
                node,
                path,
              },
            ];
          }
          return v.oneOf
            .filter(e => e !== (v.value as string))
            .map((e: string) => ({
              label: `${e} (${k})`,
              apply: R.assoc(k, { ...v, value: e }),
              node,
              path,
            }));
        }),
      ),
      nodes,
    );
    if (options.length) {
      let chosenPath: Path;
      this.handleAction(
        {
          inputKind: InputKind.OneOf,
          oneOf: options,
          getLabel: e => e.label,
          apply: (e: Option): Node<{}> => {
            chosenPath = e.path; // EXTREME HACK
            return e.node.setFlags(e.apply(e.node.flags));
          },
        },
        () => chosenPath,
      );
    }
  }
  updateNode<T>(path: Path, value: Node<T>) {
    this.setState({ tree: this.state.tree.setDeepChild(path, value) });
  }
  onActionApply = <T extends {}>(updatedNode: Node<T>) => {
    if (!this.state.inProgressAction) {
      throw new Error("Expected an action to be in-progress.");
    }
    this.setState({ inProgressAction: undefined });
    this.updateNode(this.state.inProgressAction.target(), updatedNode);
  };
  prettyPrint(
    { tree: oldTree, disablePrettier }: State = this.state,
  ): PrettyPrintResult | undefined {
    const fileNode: FileNode = oldTree.children[0].node as any;
    return fileNode.prettyPrint(
      disablePrettier
        ? undefined
        : t => {
            try {
              return prettier.format(t, PRETTIER_OPTIONS);
            } catch (e) {
              console.warn("Failed to run prettier", e);
            }
            return t;
          },
    );
  }
  getSelectedRange(printed: PrettyPrintResult): [number, number] | undefined {
    const displayTarget = this.getDeepestPossibleByDisplayPath(
      this.state.selection,
      buildDisplayTree(printed.node),
    );
    const tsTarget: ts.Node | undefined = (displayTarget.baseNode as any)
      .original;
    if (tsTarget && tsTarget.pos >= 0 && tsTarget.end >= 0) {
      return [tsTarget.pos, tsTarget.end] as [number, number];
    }
    return undefined;
  }
  tryReload() {
    const { tree } = this.state;
    const fileNode: FileNode = tree.children[0].node as any;
    const result = fileNode.prettyPrint(t =>
      prettier.format(t, PRETTIER_OPTIONS),
    );
    if (!result) {
      return;
    }
    this.setState({
      tree: tree.setChild({ ...tree.children[0], node: result.node }),
      disablePrettier: false,
    });
  }
  render() {
    const {
      selection,
      tree,
      inProgressAction,
      disablePrettier,
      disableFolding,
      prettyPrintResult: printed,
    } = this.state;
    const displayTree = buildDisplayTree(tree);
    return (
      <div style={styles.wrapper as any}>
        <div style={styles.leftPanel as {}}>
          {/* <NavTree
            navTree={buildNavTree(displayTree)}
            getDisplayTree={focusPath =>
              buildDivetreeDisplayTree(tree, focusPath)
            }
            getContent={id => <i>{id}</i>}
          /> */}
          <TreeDisplay
            root={displayTree}
            highlightPath={selection}
            disableFolding={disableFolding}
            levelsAbove={2}
            levelsBelowMatch={4}
            levelsBelowSibling={1}
          />
        </div>
        <div style={styles.rightPanel as {}}>
          Prettier: {disablePrettier ? "off" : "on"}
          <br />
          {printed && (
            <CodeDisplay
              text={printed.text}
              selectedRange={this.getSelectedRange(printed)}
            />
          )}
          {inProgressAction && (
            <ActionFiller
              action={inProgressAction.action}
              onCancel={() => this.setState({ inProgressAction: undefined })}
              onApply={this.onActionApply}
            />
          )}
        </div>
      </div>
    );
  }
}
