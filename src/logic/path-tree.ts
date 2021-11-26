import { Path } from "./interfaces";

export class PathTree {
  private children: PathTree[] = [];
  private isLeaf = false;

  traverse(
    onEnter: (path: Path) => void,
    onExit: () => void,
    prefix: Path = [],
  ) {
    if (this.isLeaf) {
      onEnter(prefix);
    }
    this.children.forEach((c, i) =>
      c.traverse(onEnter, onExit, [...prefix, i]),
    );
    if (this.isLeaf) {
      onExit();
    }
  }

  private insert(path: Path): boolean {
    if (path.length) {
      const i = path[0];
      this.children[i] = this.children[i] || new PathTree();
      return this.children[i].insert(path.slice(1));
    } else {
      const existed = this.isLeaf;
      this.isLeaf = true;
      return existed;
    }
  }
}
