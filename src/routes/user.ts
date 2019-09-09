import express from 'express';
import { ObjectID } from 'mongodb';

const userRouter = express.Router();

const COLLECTION_NAME = 'user';

const idToUuid = user => {
  const { _id, ...rest } = user;
  return { ...rest, uuid: _id };
};

const createUserRouter = dbase => {
  userRouter.get('/', function(req, res) {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    dbase
      .collection(COLLECTION_NAME)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        res.send({ user: results.map(singleUser => idToUuid(singleUser)) });
      });
  });

  userRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid, ...user } = req.body.user;

    dbase
      .collection(COLLECTION_NAME)
      .replaceOne({ _id: ObjectID(uuid) }, { ...user }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ user: { ...user, uuid } });
      });
  });

  return userRouter;
};

export default createUserRouter;
