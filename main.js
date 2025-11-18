const http = require("http");
const { program } = require("commander");
const fs = require("fs").promises;
const { XMLBuilder } = require("fast-xml-parser");
const url = require("url");
const path = require("path");

program
  .requiredOption("-i, --input <path>", "path to input JSON file")
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port");

program.parse(process.argv);
const options = program.opts();

const inputPath = path.resolve(options.input);
const host = options.host;
const port = Number(options.port);

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readPassengersData(filePath) {
  const raw = await fs.readFile(filePath, "utf8");

  try {
    return JSON.parse(raw);
  } catch {
    const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.map(line => JSON.parse(line));
  }
}

function convertToXml(passengers, includeAge) {
  const builder = new XMLBuilder({
    format: true,
    indentBy: "  ",
    suppressEmptyNode: false,
  });

  const xmlObj = {
    passengers: {
      passenger: passengers.map(p => {
        const obj = {
          name: p.Name ?? "",
          ticket: p.Ticket ?? "",
        };

        if (includeAge) {
          obj.age = p.Age ?? "";
        }

        return obj;
      }),
    },
  };

  return builder.build(xmlObj);
}

(async () => {
  if (!(await fileExists(inputPath))) {
    console.error("Cannot find input file");
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      const query = parsedUrl.query;

      let passengers = await readPassengersData(inputPath);

      passengers = Array.isArray(passengers)
        ? passengers
        : passengers.passengers ?? passengers.records ?? [];

      if (query.survived === "true") {
        passengers = passengers.filter(p => {
          return p.Survived == 1;
        });
      }

      passengers = passengers.slice(0, 500);

      const xmlResult = convertToXml(passengers, query.age === "true");

      res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
      res.end(xmlResult);

    } catch (err) {
      console.error("Server error:", err);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  });

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/`);
    console.log(`Using input file: ${inputPath}`);
  });
})();
