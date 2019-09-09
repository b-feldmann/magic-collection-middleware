import { ObjectID } from 'mongodb';

import express from 'express';
import moment from 'moment';
import CardInterface from '../interfaces/CardInterface';

const imagesRouter = express.Router();

const COLLECTION = 'images';

const createImagesRouter = dbase => {
  imagesRouter.get('/', function(req, res) {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    dbase
      .collection(COLLECTION)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        const returnedCards = results.map(single => {
          const { _id, ...image }: { image: string; _id: string } = single;
          return { ...image, uuid: _id };
        });

        res.send({ cards: returnedCards });
      });
  });

  imagesRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    dbase.collection(COLLECTION).insertOne(req.body.image, (err, result) => {
      if (err) {
        throw err;
      }

      const { _id, ...card }: { card: CardInterface; _id: string } = result.ops[0];
      const createdCard = { ...card, uuid: _id };
      res.send({ card: createdCard });
    });
  });

  imagesRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid, ...image } = req.body.card;

    dbase
      .collection(COLLECTION)
      .replaceOne({ _id: ObjectID(uuid) }, { ...image }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ card: { ...image, uuid } });
      });
  });

  return imagesRouter;
};

export default createImagesRouter;
