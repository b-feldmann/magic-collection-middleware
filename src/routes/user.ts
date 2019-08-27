import express from 'express';

const userRouter = express.Router();

const COLLECTION_USER = 'user';

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
      .collection(COLLECTION_USER)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        res.send({ user: results.map(singleUser => idToUuid(singleUser)) });
      });
  });

  return userRouter;
};

export default createUserRouter;
