import express from "express";
import { env } from "process";

import { getUpdates, getUrl, getVersions, sanitizeInfo, type PlatformInfo } from "./files.js";

const port: number = parseInt(`${env["RC_SERVICE_PORT"]}`);

const server = express();

server.use(express.json({ limit: "64mb" }));

server.post("/versions", (request, response) => {
  const info: PlatformInfo | null = sanitizeInfo(request.body, false);

  if (info) {
    response.status(200).json(Object.fromEntries(getVersions(info)));
  } else {
    response.status(400).send();
  }
});

server.post("/version", async (request, response) => {
  const info: PlatformInfo | null = sanitizeInfo(request.body, true);

  if (info) {
    response.status(200).json(await getUrl(info, `${info.version}.zip`));
  } else {
    response.status(400).send();
  }
});

server.post("/update", async (request, response) => {
  const info: PlatformInfo | null = sanitizeInfo(request.body, true);

  if (info) {
    response.status(200).json(await getUpdates(info, request.body["checksums"]));
  } else {
    response.status(400).send();
  }
});

server.get("/health", (_, response) => {
  response.status(200).send();
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
