import express from "express";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const host = "127.0.0.1";
const port = 5000;

const server = express();

function sanitizeInfo(info: any, requireVersion: boolean): boolean {
  if (!info["os"] || !info["arch"] || (requireVersion && !info["version"])) {
    return false;
  }

  if (!`${info["os"]}${info["arch"]}`.match(/^\w+$/)) {
    return false;
  }

  return !requireVersion || info["version"].match(/^\d\.\d\.\d(-beta\d)?$/);
}

server.use(express.json({ limit: "64mb" }));

server.post("/get_available_versions", (request, response) => {
  const info = request.body;

  if (!sanitizeInfo(info, false)) {
    response.status(400).send();

    return;
  }

  const root = `versions/${info["os"]}/${info["arch"]}`;

  const versions = Object.fromEntries(fs.readdirSync(root, { withFileTypes: true }).filter(file => file.isDirectory()).map(file => {
    const contents = fs.readFileSync(path.join(file.parentPath, file.name, ".checksum"), "utf-8");

    return [ file.name, contents.trim() ] as [ string, string ];
  }));

  response.status(200).json(versions);
});

server.post("/get_version", (request, response) => {
  const info = request.body;

  if (!sanitizeInfo(info, true)) {
    response.status(400).send();

    return;
  }

  const root = `versions/${info["os"]}/${info["arch"]}/${info["version"]}`;

  if (!fs.existsSync(root)) {
    response.status(400).send();

    return;
  }

  const zip = new AdmZip();

  fs.readdirSync(root, { withFileTypes: true, recursive: true }).forEach(file => {
    const full: string = path.join(file.parentPath, file.name);
    const relative: string = path.relative(root, full);

    if (file.name == ".checksum" || !file.name.endsWith(".checksum")) {
      zip.addLocalFile(full, "", relative);
    }
  });

  response.status(200).contentType("application/zip").send(zip.toBuffer());
});

server.post("/get_updated_files", (request, response) => {
  const info = request.body;

  if (!sanitizeInfo(info, true)) {
    response.status(400).send();

    return;
  }

  const root = `versions/${info["os"]}/${info["arch"]}/${info["version"]}`;

  if (!fs.existsSync(root)) {
    response.status(400).send();

    return;
  }

  const checksums = info["checksums"];

  const zip = new AdmZip();

  fs.readdirSync(root, { withFileTypes: true, recursive: true }).forEach(file => {
    const full = path.join(file.parentPath, file.name);
    const relative = path.relative(root, full);

    if (file.name == ".checksum") {
      zip.addLocalFile(full, "", relative);
    } else if (!file.name.endsWith(".checksum")) {
      const checksum = `${full}.checksum`;

      if (!(relative in checksums) || (fs.existsSync(checksum) && checksums[relative] != fs.readFileSync(checksum, "utf-8").trim())) {
        zip.addLocalFile(full, "", relative);
      }
    }
  });

  response.status(200).contentType("application/zip").send(zip.toBuffer());
});

server.listen(port, host, () => {
  console.log(`Server running at ${host}:${port}`);
});
