# magic-collection-middleware
Middleware for the [magic-collection-renderer](https://github.com/BJennWare/magic-collection-renderer)

## Requirements:
You need an .env with the following variables
- PORT: Port of the Application
- API_MONGO_ENDPOINT: Url to the mongo database
- API_MONGO_USER: user name for the mongodb
- API_MONGO_PASS: user password for the mongodb
- ACCESS_KEY: Key that users in the webapp needs for authentication

Optional:
- MONGO_URI: Full MongoDB connection string. If set, it overrides the Atlas-style connection string above — e.g. use `mongodb://localhost:27017` to connect to the local MongoDB from the docker compose file.

## Local MongoDB (docker compose)

Start a local MongoDB in a container:

```
docker compose up -d mongodb
```

Then set `MONGO_URI=mongodb://localhost:27017` in your `.env` and run the server as usual.

## Run the server

Run the server with `npm run start:dev`
Build the server with `npm run build`
