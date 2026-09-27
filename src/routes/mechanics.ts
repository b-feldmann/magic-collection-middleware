import { ObjectId } from 'mongodb';

import express from 'express';
import MechanicInterface from '../interfaces/MechanicInterface';

const mechanicRouter = express.Router();

const COLLECTION_MECHANICS = 'mechanics';
const EMPTY_MECHANIC = (): MechanicInterface => ({
  name: '',
  description: '',
});

const idToUuid = (mechanic) => {
  const { _id, ...rest } = mechanic;
  return { ...rest, uuid: _id };
};

const createMechanicRouter = (dbase) => {
  mechanicRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_MECHANICS).find().toArray();

      res.send({ mechanics: results.map((mechanic) => idToUuid(mechanic)) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  mechanicRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const mechanic = EMPTY_MECHANIC();
      const result = await dbase.collection(COLLECTION_MECHANICS).insertOne(mechanic);
      res.send({ mechanic: { ...mechanic, uuid: result.insertedId } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  mechanicRouter.put('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid, ...mechanic } = req.body.mechanic;

      await dbase
        .collection(COLLECTION_MECHANICS)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...mechanic }, { upsert: true });

      res.send({ mechanic: { ...mechanic, uuid } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return mechanicRouter;
};

export default createMechanicRouter;
