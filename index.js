const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")('sk_test_51M8kbEBhLbcvUmB2stvcZFbvjerpFRcPixbzcyHr9WGntnlVfyGrCU1jLDkfhxMUWD3AwVLK4VnvJjnB2eevV6OI00lDNBHDNU');

// midleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.PASSWORD}@cluster0.6jo974x.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


app.get('/', (req, res) => {
    res.send('hellow world');
});

const verfyJWT = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: "anathorizrd access" });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "anathorizrd access" });
        }

        req.decoded = decoded;
        next();
    });

};

async function run() {
    try {
        const Products = client.db('resalePhone').collection('products');
        const Users = client.db('resalePhone').collection('users');
        const Orders = client.db('resalePhone').collection('orders');
        const Payments = client.db('resalePhone').collection('payments');


        app.use('/jwt', async (req, res) => {
            const email = req.body.email;
            const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY, { expiresIn: '1hr' });
            res.send({ token: token });
        });



        app.get('/categoryProducts/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                category_id: id
            };

            const result = await Products.find(query).limit(3).toArray();
            res.send(result);
        });

        //get all service data 
        app.get('/allProducts', async (req, res) => {
            const cursor = Products.find({});
            const result = await cursor.toArray();
            res.send(result);
        });

        //save user
        app.post('/users', async (req, res) => {
            const user = req.body.user;
            const result = await Users.insertOne(user);
            res.send(result);
        });

        //delete a user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await Users.deleteOne(query);
            res.send(result);
        });

        //get buyer user
        app.get('/users/:role', async (req, res) => {
            const userRole = req.params.role;

            if (userRole === 'seller') {
                const query = { role: userRole };
                const users = await Users.find(query).toArray();
                res.send(users);
            }

            else {
                const query = { role: userRole };
                const users = await Users.find(query).toArray();
                res.send(users);
            }
        });

        //save orders
        app.post('/orders', async (req, res) => {
            const order = req.body.order;
            // console.log(req.body.order);
            // console.log(order);
            const result = await Orders.insertOne(order);
            res.send(result);
        });

        //get buyer order
        app.get('/orders', verfyJWT, async (req, res) => {

            const decoded = req.decoded;
            if (decoded.email !== req.query.email) {
                return res.status(401).send({ message: "anathorizrd access" });
            }
            const email = req.query.email;
            const query = { email };
            const result = await Orders.find(query).toArray();
            res.send(result);
        });

        //delete a order
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await Orders.deleteOne(query);
            res.send(result);
        });

        //delete a order
        app.get('/booking/:id', verfyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await Orders.findOne(query);
            res.send(result);
        });


        //add a product
        app.post('/product', async (req, res) => {
            const product = req.body.product;
            // console.log(req.body.product);
            // console.log(product);
            const result = await Products.insertOne(product);
            res.send(result);
        });


        //cheack seller
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await Users.findOne(query);
            res.send({ isSeller: user?.role === 'seller' });
        });


        //cheack buyer
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await Users.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        });


        //cheack admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await Users.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        });


        //get seller product
        app.get('/product', verfyJWT, async (req, res) => {

            const decoded = req.decoded;
            if (decoded.email !== req.query.email) {
                return res.status(401).send({ message: "anathorizrd access" });
            }
            const email = req.query.email;
            const query = { email };
            const result = await Products.find(query).toArray();
            res.send(result);
        });

        //delete seller product
        app.delete('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await Products.deleteOne(query);
            res.send(result);
        });

        app.post("/create-payment-intent", async (req, res) => {
            const price = req.body.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await Payments.insertOne(payment);
            const orderdID = payment.bookingId;
            const filter1 = { _id: new ObjectId(orderdID) };
            // const id = payment.orderId;
            // const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: "paid",
                    transactionId: payment.transactionId
                }
            };
            // const updatedResult = await Orders.updateOne(filter, updatedDoc);
            const updatedResult1 = await Orders.updateOne(filter1, updatedDoc);
            res.send(updatedResult1);
        });



    }
    finally {

    }
}

run().catch(error => console.log(error));


app.listen(port, () => {
    console.log('code is running');
});