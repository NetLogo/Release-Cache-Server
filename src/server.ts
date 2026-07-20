import express from "express";
import { env } from "process";

import { getUpdates, getUrl, getVersions, sanitizeInfo } from "./files.js";

const port: number = parseInt(`${env["RC_SERVICE_PORT"]}`);

const server = express();

server.use(express.json({ limit: "64mb" }));

server.post("/get_available_versions", (request, response) => {
  const info = request.body;

  if (sanitizeInfo(info, false)) {
    response.status(200).json(Object.fromEntries(getVersions(info)));
  } else {
    response.status(400).send();
  }
});

server.post("/get_version", async (request, response) => {
  const info = request.body;

  if (sanitizeInfo(info, true)) {
    response.status(200).json(await getUrl(info, `${info["version"]}.zip`));
  } else {
    response.status(400).send();
  }
});

server.post("/get_updated_files", async (request, response) => {
  const info = request.body;

  if (sanitizeInfo(info, true)) {
    response.status(200).json(await getUpdates(info));
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
