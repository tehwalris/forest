import * as _fsType from "fs";
import * as git from "isomorphic-git";
import gitHttp from "isomorphic-git/http/web";
import * as LightningFS from "@isomorphic-git/lightning-fs";
import createFsRemoteClient from "fs-remote/createClient";
import { promisify } from "util";

export interface ChosenFs {
  type: "remote" | "demo";
  fs: typeof _fsType;
  projectRootDir: string;
}

async function loadGitRepo(
  cloneUrl: string,
  fsClonePath: string,
  fs: typeof _fsType,
): Promise<void> {
  return git.clone({
    fs,
    http: gitHttp,
    dir: fsClonePath,
    corsProxy: "https://cors.isomorphic-git.org",
    url: cloneUrl,
    ref: "master",
    singleBranch: true,
    depth: 1,
  });
}

async function configureDemoFs(
  wipe: boolean,
  cloneGitUrl?: string,
): Promise<ChosenFs> {
  const demoFs = new LightningFS("forest-demo-fs", { wipe });
  if (!(await demoFs.promises.readdir("/")).length) {
    if (cloneGitUrl) {
      await loadGitRepo(cloneGitUrl, "/", demoFs);
    } else {
      await demoFs.promises.writeFile("/main.ts", "", "utf8");
    }
  }
  return { type: "demo", fs: demoFs, projectRootDir: "/" };
}

async function configureRemoteFs(): Promise<ChosenFs> {
  const remoteFs = createFsRemoteClient(
    "http://localhost:1234",
  ) as typeof _fsType;
  await promisify(remoteFs.stat)("./");
  return { type: "remote", fs: remoteFs, projectRootDir: "./" };
}

export async function configureFs(
  wipeDemo: boolean,
  cloneGitUrl?: string,
  forceDemo?: boolean,
): Promise<ChosenFs> {
  if (!forceDemo) {
    try {
      return await configureRemoteFs();
    } catch (err) {
      console.warn("Remote FS not working. Falling back to demo FS.", err);
    }
  }
  return configureDemoFs(wipeDemo, cloneGitUrl);
}
