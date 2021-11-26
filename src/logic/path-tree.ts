import { Path } from "./interfaces";

export class PathTree {
  private children: PathTree[] = [];
  private leaf: Symbol | undefined;

  traverse(
    onEnter: (path: Path, leafSymbol: Symbol) => void,
    onExit: () => void,
    prefix: Path = [],
  ) {
    if (this.leaf) {
      onEnter(prefix, this.leaf);
    }
    this.children.forEach((c, i) =>
      c.traverse(onEnter, onExit, [...prefix, i]),
    );
    if (this.leaf) {
      onExit();
    }
  }

  insert(path: Path): Symbol {
    if (path.length) {
      const i = path[0];
      this.children[i] = this.children[i] || new PathTree();
      return this.children[i].insert(path.slice(1));
    } else {
      if (!this.leaf) {
        this.leaf = Symbol();
      }
      return this.leaf;
    }
  }

  getLeafSymbol(path: Path): Symbol | undefined {
    if (path.length) {
      const i = path[0];
      return this.children[i]?.getLeafSymbol(path.slice(1));
    } else {
      return this.leaf;
    }
  }
}
