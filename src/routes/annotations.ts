import { ObjectID } from 'mongodb';

import express from 'express';
import moment from 'moment';

const annotationRouter = express.Router();

const COLLECTION_ANNOTATIONS = 'annotations';

const idToUuid = mechanic => {
  const { _id, ...rest } = mechanic;
  return { ...rest, uuid: _id };
};

const createAnnotationsRouter = dbase => {
  annotationRouter.get('/', function(req, res) {
    dbase
      .collection(COLLECTION_ANNOTATIONS)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        res.send({ annotations: results.map(annotation => idToUuid(annotation)) });
      });
  });

  annotationRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    const annotation = {
      content: req.body.content,
      author: req.body.author,
      cardReference: req.body.cardReference,
      datetime: moment().valueOf(),
      edited: false
    };

    dbase.collection(COLLECTION_ANNOTATIONS).insertOne(annotation, (err, result) => {
      if (err) {
        throw err;
      }
      res.send({ annotation: idToUuid(result.ops[0]) });
    });
  });

  annotationRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) return;

    const { uuid, ...annotation } = req.body.annotation;

    dbase
      .collection(COLLECTION_ANNOTATIONS)
      .replaceOne(
        { _id: ObjectID(uuid) },
        { ...annotation, edited: true },
        { upsert: true },
        (err, result) => {
          if (err) {
            throw err;
          }

          res.send({ annotation: { ...annotation, uuid, edited: true } });
        }
      );
  });

  return annotationRouter;
};

export default createAnnotationsRouter;
