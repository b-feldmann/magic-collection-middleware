import express from 'express';

const imagesRouter = express.Router();

const COLLECTION = 'images';

const createImagesRouter = (dbase) => {
  imagesRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const result = await dbase.collection(COLLECTION).findOne({
        $and: [{ cardUuid: req.query.cardUuid }, { face: parseInt(String(req.query.face), 10) }],
      });

      if (!result) {
        res.send();
        return;
      }

      res.send({ base64: result.base64 });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  imagesRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { base64, cardUuid, face } = req.body;

      await dbase.collection(COLLECTION).deleteOne({
        $and: [{ cardUuid }, { face: parseInt(face, 10) }],
      });

      await dbase.collection(COLLECTION).insertOne({ base64, cardUuid, face });

      res.send();
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return imagesRouter;
};

export default createImagesRouter;
