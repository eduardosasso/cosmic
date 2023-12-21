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
    let server = new FMS({
      socket: so,
      banner: "Cosmic",
      onAuthorize: handleAuthorize,
      onCommand: handleCommand,
    });
  })
  .listen(port);

// // fetch COSMOS_KEY from environment variables

const regex = /AccountEndpoint=(.*);AccountKey=(.*);/i;
const matches = cosmosKey.match(regex);
const endpoint = matches[1];
const key = matches[2];

const cosmos = new CosmosClient({ endpoint, key });

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

function handleQuery(query) {
  // Take the query, print it out
  console.log("Got Query: " + query);

  //match query that has USE in caps and something.something"
  // it should match what is in inside of `` in USE `assets.asset`
  const useRegex = /^use\s+`([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)`/i;

  // const useRegex = /^use\s+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)?/i;
  //check regex and if match create two vars one database and one called container spiliting on the .
  const isSelectingDatabase = useRegex.test(query);
  if (isSelectingDatabase) {
    const matches = query.match(useRegex);
    const database = matches[1];
    const table = matches[2];

    container = cosmos.database(database).container(table);
  }

  // check if query starts with select and has a from clause that has c as table name using regex
  // remove new lines in the query
  const singleLineQuery = query.replace(/\r?\n|\r/g, " ");

  const regex = /^select.*from\s+c\b/i;
  const isUserQuery = regex.test(singleLineQuery);

  if (!isUserQuery || !container) {
    this.sendOK({ message: "OK" });

    return;
  }

  // const container = cosmos.database("asset").container("assets");
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
