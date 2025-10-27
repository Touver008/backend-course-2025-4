const http = require('http');
const { program } = require('commander');
const fs = require('fs').promises;
const { XMLBuilder } = require('fast-xml-parser');
const url = require('url');
const path = require('path');

program
  .requiredOption('-i, --input <path>', 'path to input JSON file')
  .requiredOption('-h, --host <host>', 'server host')
  .requiredOption('-p, --port <port>', 'server port');

program.parse(process.argv);
const options = program.opts();

const inputPath = path.resolve(options.input);
const host = options.host;
const port = parseInt(options.port, 10);

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  if (!await fileExists(inputPath)) {
    console.error('Cannot find input file');
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsed = url.parse(req.url, true);
      const q = parsed.query || {};

    const raw = await fs.readFile(inputPath, 'utf8');
    let data;
    try {
    data = JSON.parse(raw);
    } catch {
    
     const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  data = lines.map(line => JSON.parse(line));
}

let records = Array.isArray(data) ? data : (data.passengers || data.records || []);

      if (String(q.survived) === 'true') {
        records = records.filter(r => {
          const val = r.Survived ?? r.survived ?? r.survived_flag;
          return val === 1 || val === '1' || val === true || val === 'true';
        });
      }

      const MAX_RETURN = 500;
      if (records.length > MAX_RETURN) records = records.slice(0, MAX_RETURN);

      const passengersXmlObj = {
        passengers: {
          passenger: records.map(r => {
            const name = r.Name ?? r.name ?? r.FullName ?? '';
            const ticket = r.Ticket ?? r.ticket ?? '';
            const ageVal = r.Age ?? r.age ?? null;

            const passengerObj = {
              name: name
            };

            if (String(q.age) === 'true') {
              passengerObj.age = (ageVal !== null && ageVal !== undefined) ? String(ageVal) : '';
            }

            passengerObj.ticket = ticket;

            return passengerObj;
          })
        }
      };

      const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        indentBy: "  ",
        suppressEmptyNode: false
      });

      const xmlContent = builder.build(passengersXmlObj);

      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      res.end(xmlContent);
    } catch (err) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  });

  server.listen(port, host, () => {
    console.log(`Server listening at http://${host}:${port}/`);
    console.log(`Using input file: ${inputPath}`);
  });
})();
