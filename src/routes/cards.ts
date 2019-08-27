import { ObjectID } from 'mongodb';

import express from 'express';

import CardInterface from '../interfaces/CardInterface';
import { CardMainType, CardState, RarityType } from '../interfaces/enums';

import moment = require('moment');

const cardRouter = express.Router();

const COLLECTION_CARDS = 'cards';
const EMPTY_CARD = (): CardInterface => ({
  name: '',
  front: {
    name: '',
    cardMainType: CardMainType.Creature,
    cardText: []
  },
  manaCost: '',
  rarity: RarityType.Common,
  meta: {
    comment: '',
    likes: [],
    dislikes: [],
    lastUpdated: moment().valueOf(),
    createdAt: moment().valueOf(),
    state: CardState.Draft
  }
});

const createCardRouter = dbase => {
  cardRouter.get('/', function(req, res) {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    dbase
      .collection(COLLECTION_CARDS)
      .find()
      .toArray((err, results) => {
        if (err) {
          throw err;
        }

        const returnedCards = results.map(single => {
          const { _id, ...card }: { card: CardInterface; _id: string } = single;
          return { ...card, uuid: _id };
        });

        res.send({ cards: returnedCards });
      });
  });

  cardRouter.post('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const newCard = EMPTY_CARD();
    newCard.creator = req.body.creator;
    dbase.collection(COLLECTION_CARDS).insertOne(newCard, (err, result) => {
      if (err) {
        throw err;
      }

      const { _id, ...card }: { card: CardInterface; _id: string } = result.ops[0];
      const createdCard = { ...card, uuid: _id };
      res.send({ card: createdCard });
    });
  });

  cardRouter.put('/', (req, res, next) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid, ...card } = req.body.card;
    card.meta.lastUpdated = moment().valueOf();

    dbase
      .collection(COLLECTION_CARDS)
      .replaceOne({ _id: ObjectID(uuid) }, { ...card }, { upsert: true }, (err, result) => {
        if (err) {
          throw err;
        }

        res.send({ card: { ...card, uuid } });
      });
  });

  return cardRouter;
};

export default createCardRouter;
