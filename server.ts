import express from "express";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

const server = express();

server.use(express.json({ limit: "64mb" }));

server.post("/get_available_versions", (request, response) => {
    const info = request.body;

    if (!`${info["os"]}${info["arch"]}`.match(/^\w+$/)) {
        response.statusCode = 403;
        response.end();

        return;
    }

    const root = `versions/${info["os"]}/${info["arch"]}`;

    const versions = Object.fromEntries(fs.readdirSync(root, { withFileTypes: true }).filter(file => file.isDirectory()).map(file => {
        const contents = fs.readFileSync(path.join(file.parentPath, file.name, ".checksum"), "utf-8");

        return [ file.name, contents.trim() ] as [ string, string ];
    }));

    response.statusCode = 200;
    response.contentType("application/json");
    response.json(versions);
});

server.post("/get_updated_files", (request, response) => {
    const info = request.body;

    if (!`${info["os"]}${info["arch"]}`.match(/^\w+$/) || !info["version"].match(/^\d\.\d\.\d(-beta\d)?$/)) {
        response.statusCode = 403;
        response.end();

        return;
    }

    const root = `versions/${info["os"]}/${info["arch"]}/${info["version"]}`;

    const checksums = info["checksums"];

    const zip = new AdmZip();

    fs.readdirSync(root, { withFileTypes: true, recursive: true }).forEach(file => {
        const full = path.join(file.parentPath, file.name);
        const relative = path.relative(root, full);

        if (file.name == ".checksum") {
            zip.addLocalFile(full, "", relative);
        }

        else if (!file.name.endsWith(".checksum")) {
            const checksum = `${full}.checksum`;

            if (!(relative in checksums) || (fs.existsSync(checksum) && checksums[relative] != fs.readFileSync(checksum, "utf-8").trim())) {
                zip.addLocalFile(full, "", relative);
            }
        }
    });

    response.statusCode = 200;
    response.contentType("application/zip");
    response.send(zip.toBuffer());
})

server.listen(5000, "127.0.0.1");

console.log("Server running at 127.0.0.1:5000");
