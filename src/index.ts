import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';

import express, { Request, Response } from 'express';

import { MongoClient, ObjectID } from 'mongodb';
import BodyParser from 'body-parser';
import createCardRouter from './routes/cards';

dotenv.config();
const app = express();
const { PORT = 3001 } = process.env;

app.use(cors());
app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req: Request, res: Response) => {
  res.send({
    message: 'Welcome to the Magic FunSet Api :)'
  });
});

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
    }
  );
}
export default app;
