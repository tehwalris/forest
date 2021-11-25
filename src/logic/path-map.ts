import { Path } from "./interfaces";
import { pathsAreEqual } from "./path-utils";

export class PathMap<T> {
  private data: { key: Path; value: T }[] = [];

  private findIndex(key: Path): number {
    return this.data.findIndex((e) => pathsAreEqual(e.key, key));
  }

  get(key: Path): T | undefined {
    const i = this.findIndex(key);
    if (i === -1) {
      return undefined;
    }
    return this.data[i].value;
  }

  has(key: Path): boolean {
    return this.findIndex(key) !== -1;
  }

  set(key: Path, value: T): PathMap<T> {
    const i = this.findIndex(key);
    if (i === -1) {
      this.data.push({ key, value });
    } else {
      this.data[i].value = value;
    }
    return this;
  }

  delete(key: Path): boolean {
    const i = this.findIndex(key);
    if (i === -1) {
      return false;
    } else {
      this.data.splice(i, 1);
      return true;
    }
  }

  get size(): number {
    return this.data.length;
  }

  clear() {
    this.data = [];
  }

  clone(): PathMap<T> {
    const other = new PathMap<T>();
    other.data = this.data.map((e) => ({ ...e }));
    return other;
  }
}
