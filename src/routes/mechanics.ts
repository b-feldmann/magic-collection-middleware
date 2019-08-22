import { ObjectID } from 'mongodb';

import express from 'express';
import MechanicInterface from '../interfaces/MechanicInterface';

const mechanicRouter = express.Router();

const COLLECTION_MECHANICS = 'mechanics';
const EMPTY_MECHANIC = (): MechanicInterface => ({
  name: '',
  description: ''
});

const idToUuid = mechanic => {
  const { _id, ...rest } = mechanic;
  return { ...rest, uuid: _id };
};

const createMechanicRouter = dbase => {
  mechanicRouter.get('/', function(req, res) {
    dbase
      .collection(COLLECTION_MECHANICS)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        res.send({ mechanics: results.map(mechanic => idToUuid(mechanic)) });
      });
  });

  mechanicRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    dbase.collection(COLLECTION_MECHANICS).insertOne(EMPTY_MECHANIC(), (err, result) => {
      if (err) {
        throw err;
      }
      res.send({ mechanic: idToUuid(result.ops[0]) });
    });
  });

  mechanicRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    const { uuid, ...mechanic } = req.body.mechanic;

    dbase
      .collection(COLLECTION_MECHANICS)
      .replaceOne({ _id: ObjectID(uuid) }, { ...mechanic }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ mechanic: { ...mechanic, uuid } });
      });
  });

  return mechanicRouter;
};

export default createMechanicRouter;
