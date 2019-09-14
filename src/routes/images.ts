import { ObjectID } from 'mongodb';

import express from 'express';

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
      .findOne(
        { $and: [{ cardUuid: req.query.cardUuid }, { face: parseInt(req.query.face, 10) }] },
        (err, result) => {
          if (err) {
            throw err;
          }

          if (!result) {
            res.send();
            return;
          }

          res.send({ base64: result.base64 });
        }
      );
  });

  imagesRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { base64, cardUuid, face } = req.body;

    dbase
      .collection(COLLECTION)
      .removeOne({ $and: [{ cardUuid }, { face: parseInt(face, 10) }] }, (err, result) => {
        if (err) {
          throw err;
        }

        dbase.collection(COLLECTION).insertOne({ base64, cardUuid, face }, (err, result) => {
          if (err) {
            throw err;
          }

          res.send();
        });
      });
  });

  return imagesRouter;
};

export default createImagesRouter;
