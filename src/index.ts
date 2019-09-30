import dotenv from 'dotenv';
import cors from 'cors';

import express, { Request, Response } from 'express';

import { MongoClient, ObjectID } from 'mongodb';
import BodyParser from 'body-parser';
import * as path from 'path';
import createCardRouter from './routes/cards';
import createMechanicRouter from './routes/mechanics';
import createAnnotationsRouter from './routes/annotations';
import createUserRouter from './routes/user';
import createImagesRouter from './routes/images';
import createDeckRouter from './routes/decks';

dotenv.config();
const app = express();
const { PORT = 8080 } = process.env;

app.use(cors());
app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const databaseName = process.env.NODE_ENV === 'development' ? 'mtg-funset-test' : 'mtg-funset';
const databaseNameDeckBuilder = 'deck-builder';

if (require.main === module) {
  // true if file is executed

  MongoClient.connect(
    `mongodb+srv://${process.env.API_MONGO_USER}:${process.env.API_MONGO_PASS}@${process.env.API_MONGO_ENDPOINT}/test?retryWrites=true&w=majority`,
    (connectErr, db) => {
      const dbase = db.db(databaseName);
      const dbaseDeckBuilder = db.db(databaseNameDeckBuilder);
      if (connectErr) {
        console.log(connectErr);
        return;
      }

      app.listen(PORT, () => {
        console.log(`server started at http://localhost:${PORT}`);
      });

      app.use('/cards', createCardRouter(dbase));
      app.use('/mechanics', createMechanicRouter(dbase));
      app.use('/annotations', createAnnotationsRouter(dbase));
      app.use('/user', createUserRouter(dbase));
      app.use('/images', createImagesRouter(dbase));

      app.use('/decks', createDeckRouter(dbaseDeckBuilder));
    }
  );
}
export default app;
