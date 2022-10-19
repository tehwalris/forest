import * as LightningFS from "@isomorphic-git/lightning-fs";
import AdmZip from "adm-zip";
import { Buffer } from "buffer";
import * as _fsType from "fs";
import createFsRemoteClient from "fs-remote/createClient";
import path from "path";
import { promisify } from "util";

export type Fs = typeof _fsType;

export interface ChosenFs {
  type: "remote" | "demo";
  fs: Fs;
  projectRootDir: string;
  probablyEmpty: boolean;
}

async function configureDemoFs(
  wipe: boolean,
  zipUrl: string,
): Promise<ChosenFs> {
  const demoFs = new LightningFS("forest-demo-fs", { wipe });
  const empty = !(await demoFs.promises.readdir("/")).length;
  if (zipUrl && empty) {
    const zipArrayBuffer = await fetch("/demo.zip").then((r) =>
      r.arrayBuffer(),
    );
    const zipEntries = new AdmZip(Buffer.from(zipArrayBuffer)).getEntries();
    for (const entry of zipEntries) {
      const entryPath = path.join("/", entry.entryName);
      if (entry.isDirectory) {
        await demoFs.promises.mkdir(entryPath);
      } else {
        await demoFs.promises.writeFile(entryPath, entry.getData());
      }
    }
  }
  return {
    type: "demo",
    fs: demoFs,
    projectRootDir: "/",
    probablyEmpty: false,
  };
}

async function configureRemoteFs(): Promise<ChosenFs> {
  const remoteFs = createFsRemoteClient(
    "http://localhost:1234",
  ) as typeof _fsType;
  await promisify(remoteFs.stat)("./");
  return {
    type: "remote",
    fs: remoteFs,
    projectRootDir: "./",
    probablyEmpty: false,
  };
}

export async function configureFs(
  wipeDemo: boolean,
  demoZipUrl: string,
  forceDemo?: boolean,
): Promise<ChosenFs> {
  if (!forceDemo) {
    try {
      return await configureRemoteFs();
    } catch (err) {
      console.warn("Remote FS not working. Falling back to demo FS.", err);
    }
  }
  return configureDemoFs(wipeDemo, demoZipUrl);
}
