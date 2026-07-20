import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { env } from "process";

const s3 = new S3Client({
  region: "enam",
  endpoint: env["RC_S3_ENDPOINT"],
  credentials: {
    accessKeyId: `${env["RC_S3_ACCESS"]}`,
    secretAccessKey: `${env["RC_S3_SECRET"]}`
  }
});

export interface PlatformInfo {
  os: string;
  arch: string;
  version?: string;
}

interface Update {
  path: string;
  url: string;
  length: number;
}

function rootPath(info: PlatformInfo): string {
  return `versions/${info.os}/${info.arch}`;
}

function checksumPath(info: PlatformInfo): string {
  return `versions/${info.os}/${info.arch}/${info.version}.json`;
}

export function sanitizeInfo(info: any, requireVersion: boolean): PlatformInfo | null {
  if (!info["os"] || !info["arch"] || (requireVersion && !info["version"])) {
    return null;
  }

  if (!`${info["os"]}${info["arch"]}`.match(/^\w+$/)) {
    return null;
  }

  if (requireVersion) {
    if (info["version"].match(/^\d\.\d\.\d(-beta\d)?$/) && fs.existsSync(checksumPath(info))) {
      return {
        os: info["os"],
        arch: info["arch"],
        version: info["version"]
      };
    }
  } else if (fs.existsSync(rootPath(info))) {
    return {
      os: info["os"],
      arch: info["arch"]
    };
  }

  return null;
}

export function getVersions(info: PlatformInfo): [string, string][] {
  return fs.readdirSync(rootPath(info), { withFileTypes: true }).map(file => {
    const contents = JSON.parse(fs.readFileSync(path.join(file.parentPath, file.name), "utf-8"));

    return [ file.name.replace(".json", ""), contents[".checksum"] ] as [string, string];
  });
}

export function getUrl(info: PlatformInfo, path: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: "release-cache",
    Key: `${info.os}/${info.arch}/${path}`
  }), {
    expiresIn: 3000
  });
}

export function getLength(info: PlatformInfo, path: string): Promise<number> {
  return s3.send(new HeadObjectCommand({
    Bucket: "release-cache",
    Key: `${info.os}/${info.arch}/${path}`
  })).then(response => response.ContentLength ?? 0, _ => 0)
}

export async function getUpdates(info: PlatformInfo, checksums: any): Promise<Update[]> {
  const stored = JSON.parse(fs.readFileSync(checksumPath(info), "utf-8"));

  const updates: Update[] = [];

  for (const key in stored) {
    if (checksums[key] != stored[key]) {
      updates.push({
        path: key,
        url: await getUrl(info, `${info.version}/${key}`),
        length: await getLength(info, `${info.version}/${key}`)
      });
    }
  }

  return updates;
}
