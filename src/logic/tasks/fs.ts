import * as _fsType from "fs";
import createFsRemoteClient from "fs-remote/createClient";
import { promisify } from "util";
export type Fs = typeof _fsType;
export async function configureRemoteFs(): Promise<Fs> {
  const remoteFs = createFsRemoteClient("http://localhost:1234") as any as Fs;
  await promisify(remoteFs.stat)("./");
  return remoteFs;
}
