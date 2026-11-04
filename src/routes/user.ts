import express from 'express';
import { ObjectId } from 'mongodb';

const userRouter = express.Router();

const COLLECTION_NAME = 'user';

const idToUuid = (user) => {
  const { _id, ...rest } = user;
  return { ...rest, uuid: _id };
};

const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

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

  // Applies only the given changes, so a client holding an outdated copy of the
  // user cannot erase state saved by another tab or device.
  userRouter.patch('/:uuid', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid } = req.params;
    const { seenCards, seenComments, lastSeenVersion } = req.body;
    if (
      !ObjectId.isValid(uuid) ||
      (seenCards === undefined && seenComments === undefined && lastSeenVersion === undefined) ||
      (seenCards !== undefined && !isStringArray(seenCards)) ||
      (seenComments !== undefined && !isStringArray(seenComments)) ||
      (lastSeenVersion !== undefined && !Number.isInteger(lastSeenVersion))
    ) {
      res.sendStatus(400);
      return;
    }

    const added = {
      ...(seenCards ? { seenCards: { $each: seenCards } } : {}),
      ...(seenComments ? { seenComments: { $each: seenComments } } : {}),
    };

    try {
      const user = await dbase.collection(COLLECTION_NAME).findOneAndUpdate(
        { _id: new ObjectId(uuid) },
        {
          ...(Object.keys(added).length ? { $addToSet: added } : {}),
          ...(lastSeenVersion !== undefined ? { $max: { lastSeenVersion } } : {}),
        },
        { returnDocument: 'after' },
      );
      if (!user) {
        res.sendStatus(404);
        return;
      }

      res.send({ user: idToUuid(user) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return userRouter;
};

export default createUserRouter;
