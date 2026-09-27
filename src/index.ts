import dotenv from 'dotenv';
import cors from 'cors';

import express from 'express';

import { MongoClient } from 'mongodb';
import * as path from 'path';
import createCardRouter from './routes/cards';
import createMechanicRouter from './routes/mechanics';
import createAnnotationsRouter from './routes/annotations';
import createUserRouter from './routes/user';
import createImagesRouter from './routes/images';
import createDeckRouter from './routes/decks';

dotenv.config({ quiet: true });
const app = express();
const { PORT = 8080 } = process.env;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const databaseName = process.env.NODE_ENV === 'development' ? 'mtg-funset-test' : 'mtg-funset';
const databaseNameDeckBuilder = 'deck-builder';

if (require.main === module) {
  // true if file is executed

  const mongoUri =
    process.env.MONGO_URI ||
    `mongodb+srv://${process.env.API_MONGO_USER}:${process.env.API_MONGO_PASS}@${process.env.API_MONGO_ENDPOINT}/test?retryWrites=true&w=majority`;

  const client = new MongoClient(mongoUri);

  client
    .connect()
    .then((db) => {
      const dbase = db.db(databaseName);
      const dbaseDeckBuilder = db.db(databaseNameDeckBuilder);

      app.listen(PORT, () => {
        console.log(`server started at http://localhost:${PORT}`);
      });

      app.use('/cards', createCardRouter(dbase));
      app.use('/mechanics', createMechanicRouter(dbase));
      app.use('/annotations', createAnnotationsRouter(dbase));
      app.use('/user', createUserRouter(dbase));
      app.use('/images', createImagesRouter(dbase));

      app.use('/decks', createDeckRouter(dbaseDeckBuilder));

      app.get('*', (req, res) => {
        res.sendFile(path.join(`${__dirname}/public/index.html`));
        // res.send('foo');
      });
    })
    .catch((connectErr) => {
      console.log(connectErr);
    });
}
export default app;
