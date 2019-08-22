import dotenv from 'dotenv';
import cors from 'cors';

import express, { Request, Response } from 'express';

import { MongoClient, ObjectID } from 'mongodb';
import BodyParser from 'body-parser';
import createCardRouter from './routes/cards';
import createMechanicRouter from './routes/mechanics';
import createAnnotationsRouter from './routes/annotations';
import createUserRouter from "./routes/user";

dotenv.config();
const app = express();
const { PORT = 8080 } = process.env;

app.use(cors());
app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

if (require.main === module) {
  // true if file is executed

  MongoClient.connect(
    `mongodb+srv://${process.env.API_MONGO_USER}:${process.env.API_MONGO_PASS}@${process.env.API_MONGO_ENDPOINT}/test?retryWrites=true&w=majority`,
    (connectErr, db) => {
      const dbase = db.db('mtg-funset');
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
    }
  );
}
export default app;
