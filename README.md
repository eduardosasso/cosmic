# Cosmic
Query Azure Cosmos DB using your favorite MySQL UI client.  
It works by emulating MySQL’s protocol to proxy calls to Cosmos DB.  

The idea came out of frustration trying to use Cosmos limited web UI and longing for the good old days of better developer experience and native functionality provided by apps like Sequel Ace and Table Plus. 

## Installation
Make sure `node 20.x` or higher is installed.

```
mkdir cosmic && cd cosmic
git clone git@github.com:eduardosasso/cosmic.git
npm install
```

## Running
In Azure portal, go to the Cosmos DB account to get the endpoint of the database to connect.

```
node main.js "--cosmos=AccountEndpoint=https://{{cosmos url}}:443/;AccountKey={{key}};" --port 3306
```

## Usage
Use `localhost` or `127.0.0.1` as the host to connect. In the database field, use `database-name.container` to select which container to use in Cosmos. 

Run SQL queries using cosmos syntax and any supported functions e.g.
```
select top 10 c.id from c
```

We have tested Cosmic in the following clients:

* [MySQL Cli](https://dev.mysql.com/doc/refman/8.0/en/mysql.html)
  * ```
    mysql -h 127.0.0.1 -P 3306 -D {{database.container}}
    ```
* [Table Plus](https://tableplus.com)
* [Sequel Ace](https://sequel-ace.com)

## Features
Cosmic supports two operating modes, `JSON` and table format.
The default JSON format returns query results as they are.

When you use the `-- table` flag, the system returns results in a tabulated format, like a relational database using root-level keys as columns. e.g.

```
-- table
select * from c where c.id='123'
```

## Credits
This project makes use of [faux-mysql-server](https://github.com/CloudQuote/faux-mysql-server), which is an open-source project licensed under the GNU General Public License (GPL). 
