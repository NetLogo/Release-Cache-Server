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

interface Update {
  path: string,
  url: string,
  length: number
}

function rootPath(info: any): string {
  return `versions/${info["os"]}/${info["arch"]}`;
}

function checksumPath(info: any): string {
  return `versions/${info["os"]}/${info["arch"]}/${info["version"]}.json`;
}

export function sanitizeInfo(info: any, requireVersion: boolean): boolean {
  if (!info["os"] || !info["arch"] || (requireVersion && !info["version"])) {
    return false;
  }

  if (!`${info["os"]}${info["arch"]}`.match(/^\w+$/)) {
    return false;
  }

  if (requireVersion) {
    return info["version"].match(/^\d\.\d\.\d(-beta\d)?$/) && fs.existsSync(checksumPath(info));
  }

  return fs.existsSync(rootPath(info));
}

export function getVersions(info: any): [string, string][] {
  return fs.readdirSync(rootPath(info), { withFileTypes: true }).map(file => {
    const contents = JSON.parse(fs.readFileSync(path.join(file.parentPath, file.name), "utf-8"));

    return [ file.name.replace(".json", ""), contents[".checksum"] ] as [string, string];
  });
}

export function getUrl(info: any, path: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: "release-cache",
    Key: `${info["os"]}/${info["arch"]}/${path}`
  }), {
    expiresIn: 3000
  });
}

export function getLength(info: any, path: string): Promise<number> {
  return s3.send(new HeadObjectCommand({
    Bucket: "release-cache",
    Key: `${info["os"]}/${info["arch"]}/${path}`
  })).then(response => response.ContentLength ?? 0, _ => 0)
}

export async function getUpdates(info: any): Promise<Update[]> {
  const oldChecksums = info["checksums"];
  const newChecksums = JSON.parse(fs.readFileSync(checksumPath(info), "utf-8"));

  const updates: Update[] = [];

  for (const key in newChecksums) {
    if (oldChecksums[key] != newChecksums[key]) {
      updates.push({
        path: key,
        url: await getUrl(info, `${info["version"]}/${key}`),
        length: await getLength(info, `${info["version"]}/${key}`)
      });
    }
  }

  return updates;
}
