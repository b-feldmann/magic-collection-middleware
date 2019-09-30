import express from 'express';
import { ObjectID } from 'mongodb';

const deckRouter = express.Router();

const COLLECTION_NAME = 'decks';

const idToUuid = user => {
  const { _id, ...rest } = user;
  return { ...rest, uuid: _id };
};

const createDeckRouter = dbase => {
  deckRouter.get('/all', function(req, res) {
    dbase
      .collection(COLLECTION_NAME)
      .find({ hash: req.query.hash })
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        res.send({
          decks: results.map(singleDeck => ({
            name: singleDeck.name,
            uuid: singleDeck._id,
            cover: singleDeck.cover,
            commander: singleDeck.commander
          }))
        });
      });
  });

  deckRouter.get('/', function(req, res) {
    dbase.collection(COLLECTION_NAME).findOne({ _id: ObjectID(req.query.uuid) }, (err, result) => {
      if (err) {
        throw err;
      }

      res.send({ deck: idToUuid(result) });
    });
  });

  deckRouter.post('/', (req, res, next) => {
    const { name, hash, cover, commander } = req.body;

    dbase
      .collection(COLLECTION_NAME)
      .insertOne({ name, hash, cover, commander, cards: [] }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ deck: { name: result.ops[0].name, uuid: result.ops[0]._id } });
      });
  });

  deckRouter.put('/', (req, res, next) => {
    const { uuid, ...deck } = req.body.deck;

    dbase
      .collection(COLLECTION_NAME)
      .replaceOne({ _id: ObjectID(uuid) }, { ...deck }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ deck: { ...deck, uuid } });
      });
  });

  return deckRouter;
};

export default createDeckRouter;
