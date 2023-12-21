import net from "net";
import FMS, { consts } from "./mysql.js";
import { CosmosClient } from "@azure/cosmos";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv)).argv;

const cosmosKey = argv.cosmos || "";
const port = argv.port || 3306;

net
  .createServer((so) => {
    new FMS({
      socket: so,
      banner: "Cosmic",
      onAuthorize: handleAuthorize,
      onCommand: handleCommand,
    });

    so.on("error", (err) => {
      console.error(err);
    });
  })
  .listen(port);

const regex = /AccountEndpoint=(.*);AccountKey=(.*);/i;
const matches = cosmosKey.match(regex);
const endpoint = matches[1];
const key = matches[2];

let cosmos = new CosmosClient({ endpoint, key });

function handleAuthorize(param) {
  return true;
}

function handleCommand({ command, extra }) {
  // command is a numeric ID, extra is a Buffer
  switch (command) {
    case consts.COM_QUERY:
      handleQuery.call(this, extra.toString());
      break;
    case consts.COM_PING:
      this.sendOK({ message: "OK" });
      break;
    case null:
    case undefined:
    case consts.COM_QUIT:
      console.log("Disconnecting");
      this.end();
      break;
    default:
      console.log("Unknown Command: " + command);
      this.sendError({ message: "Unknown Command" });
      break;
  }
}

let container = null;
let database = null;
let table = null;

function handleQuery(query) {
  console.log(query);

  const useRegex = /^use\s+`([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)`/i;

  //create regex that matches kill query string
  const killRegex = /^kill\s+query\s+(\d+)/i;
  
  //check if query is kill query
  const isKillQuery = killRegex.test(query);
  if (isKillQuery) {
    cosmos = new CosmosClient({ endpoint, key });
    //throw js exception to kill query
    // throw "Query was killed";

    this.sendError({ message: "Query was killed" });

    return;
  }

  const isSelectingDatabase = useRegex.test(query);
  if (isSelectingDatabase) {
    const matches = query.match(useRegex);
    database = matches[1];
    table = matches[2];

    container = cosmos.database(database).container(table);
  }

  const singleLineQuery = query.replace(/\r?\n|\r/g, " ");

  const regex = /^select.*from\s+c\b/i;
  const isUserQuery = regex.test(singleLineQuery);

  if (!isUserQuery || !container) {
    this.sendOK({ message: "OK" });

    return;
  }

  const querySpec = { query: singleLineQuery };

  const definitions = [];
  const results = [];

  container.items
    .query(querySpec)
    .fetchAll()
    .then((result) => {
      for (let i = 0; i < result.resources.length; i++) {
        const item = result.resources[i];

        const keys = Object.keys(item);
        let row = [];
        keys.forEach((key) => {
          const value = item[key];

          if (typeof value === "object") {
            item[key] = JSON.stringify(value);
          }

          row.push(item[key]);

          if (i > 0) return;

          definitions.push(
            this.newDefinition({
              name: key,
              columnType: consts.MYSQL_TYPE_LONG_BLOB,
            })
          );
        });

        results.push(row);
      }

      this.sendDefinitions(definitions);
      this.sendRows(results);
    })
    .catch((err) => {
      this.sendError({ message: err.message });
    });
}
