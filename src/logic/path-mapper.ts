import { Path } from "./interfaces";
import { getCommonPathPrefix, pathsAreEqual } from "./path-utils";

export interface PathMapping {
  old: Path;
  new: Path;
}

export class PathMapper {
  private mappings: PathMapping[] = [];

  constructor(private prefix: Path) {}

  record(m: PathMapping) {
    this.mappings.push(m);
  }

  mapRough(oldExternalPath: Path): Path {
    if (
      !pathsAreEqual(oldExternalPath.slice(0, this.prefix.length), this.prefix)
    ) {
      return oldExternalPath;
    }
    const oldPath = oldExternalPath.slice(this.prefix.length);

    let bestMapping: PathMapping | undefined;
    for (const m of this.mappings) {
      if (
        !bestMapping ||
        getCommonPathPrefix(m.old, oldPath).length >
          getCommonPathPrefix(bestMapping.old, oldPath).length
      ) {
        bestMapping = m;
      }
    }
    if (!bestMapping) {
      return oldExternalPath;
    }
    const common = getCommonPathPrefix(bestMapping.old, oldPath);
    return [
      ...this.prefix,
      ...bestMapping.new.slice(0, common.length),
      ...oldPath.slice(common.length),
    ];
  }
}
