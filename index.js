require('dotenv').config()

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

//firebase
const admin = require("firebase-admin");

const serviceAccount = require("./smart-deals-firebase-admin-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


//middleware
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
    console.log("logging info");
    next();
}

const verifiedFirebaseToken = async (req, res, next) => {
    // console.log('in the verify ',req.headers.authorization);

    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access..' })
    }

    const token = req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access..' })
    }


    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        console.log('after token validation :', userInfo);
        next();
    } catch {
        return res.status(401).send({ message: 'unauthorized access..' });
        console.log('Invalid ')
    }
}

//FwRGM59pe9sjHUuh
//smartDealsDB
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.m0fnk2l.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

app.get('', (req, res) => {
    res.send('Server is running');
})

async function run() {
    try {
        await client.connect();

        const db = client.db("smart-deals-db")
        const productsCollection = db.collection('products')
        const bidsCollection = db.collection('bids');
        const userCollection = db.collection('users');

        //products collection
        app.get('/products', async (req, res) => {
            // const projectFields = {
            //     _id: 0,
            //     title: 1,
            //     price_min: 1,
            //     price_max: 1,
            // }
            // const causer = productsCollection.find().sort({ price_min: -1}).skip(1).limit(2).project(projectFields);
            console.log(req.query);
            const email = req.query.email;
            const query = {};
            if (email) {
                query.email = email;
            }
            const causer = productsCollection.find(query);

            const result = await causer.toArray();
            res.send(result);
        })

        app.get('/latestProducts', async (req, res) => {
            const causer = productsCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await causer.toArray();
            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.findOne(query);
            res.send(result);
        })

        app.post('/products',verifiedFirebaseToken, async (req, res) => {
            const newProduct = req.body;
            // console.log('header in the post',req.headers)
            const result = await productsCollection.insertOne(newProduct);
            res.send(result);
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id;
            const updateProducts = req.body;
            const query = { _id: id }
            const update = {
                $set: { name: updateProducts.name, price: updateProducts.price }
            };
            const result = await productsCollection.updateOne(query, update);
            res.send(result);
        })

        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        //bids collection
        app.get('/bids', logger, verifiedFirebaseToken, async (req, res) => {
            const email = req.query.email;
            // console.log('header',req.headers)
            const query = {};
            if (email) {
                if (email !== req.token_email) {
                    return res.status(403).send('forbidden access..')
                }
                query.buyer_email = email;
            }
            const causer = bidsCollection.find(query);
            const result = await causer.toArray();
            res.send(result);
        })

        app.get('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bidsCollection.findOne(query);
            res.send(result);
        })

        app.get('/products/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId }
            const causer = bidsCollection.find(query).sort({ bid_price: -1 })
            const result = await causer.toArray();
            res.send(result);
        })

        app.post('/bids', async (req, res) => {
            const newBids = req.body;
            const result = bidsCollection.insertOne(newBids);
            res.send(result);
        })

        app.patch('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const updateBids = req.body;
            const query = { _id: new ObjectId(id) }
            const update = {
                $set: { name: updateBids.buyer_name }
            };
            const result = await bidsCollection.updateOne(query, update);
            res.send(result);
        })

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        })


        //user collection
        app.post('/users', async (req, res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = { email: email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                res.send({ message: "User already exist , do not insert again.." })
            } else {
                const result = await userCollection.insertOne(newUser);
                res.send(result);
            }
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.log(console.dir));


app.listen(port, () => {
    console.log(`server running as port : ${port}`)
})
