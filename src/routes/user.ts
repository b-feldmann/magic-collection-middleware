import express from 'express';
import { ObjectId } from 'mongodb';

const userRouter = express.Router();

const COLLECTION_NAME = 'user';

const idToUuid = (user) => {
  const { _id, ...rest } = user;
  return { ...rest, uuid: _id };
};

const createUserRouter = (dbase) => {
  userRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_NAME).find().toArray();

      res.send({ user: results.map((singleUser) => idToUuid(singleUser)) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  userRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { user } = req.body;

      await dbase.collection(COLLECTION_NAME).insertOne(user);

      res.send({ user: idToUuid(user) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  userRouter.put('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid, ...user } = req.body.user;

      await dbase
        .collection(COLLECTION_NAME)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...user }, { upsert: true });

      res.send({ user: { ...user, uuid } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return userRouter;
};

export default createUserRouter;
