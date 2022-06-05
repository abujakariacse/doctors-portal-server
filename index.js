const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require("dotenv").config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.b8yrs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Foridden' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {

    try {
        await client.connect()
        const serviceCollection = client.db('doctors-portal').collection('service');
        const bookingCollection = client.db('doctors-portal').collection('bookings');
        const userCollection = client.db('doctors-portal').collection('users');

        // To check server is running or not on browser
        app.get('/', (req, res) => {
            res.send('Server is running.....')
        });

        // Limit dashboard feature using admin role
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email: email });
            const role = result.role;
            res.send({ role })
        })

        // Set admin role
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({
                email: requester
            });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: {
                        role: 'admin'
                    }
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Access Denied' })
            }

        });

        // Remove as admin 
        app.put('/admin/remove/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: {
                        role: 'user'
                    }
                }
                const options = { upsert: true };
                const result = await userCollection.updateOne(filter, updateDoc, options);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'Access Denied' })
            }

        })

        // Delete a user
        app.delete('/user/delete/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        // Get token
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '14d' });
            res.send({ result, token });
        })

        // Get all services
        app.get('/service', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });


        // Book a service
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });
        });

        // Delete booking
        app.delete('/booking/delete/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        })

        // Filter all booked slot to remove or hide from UI. Cause, If anyone try to buy it will not show
        app.get('/availableSlots', async (req, res) => {
            const date = req.query.date;

            // Step - 1
            // Get all services for all information also with slots
            const services = await serviceCollection.find().toArray();

            // Step - 2
            // Get all bookings
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();

            // Step - 3
            // Loop all services to get service and check bookings are for whom
            services.forEach(service => {
                // Step - 4 
                // Check Service to make sure that booking for whom
                const serviceBooking = bookings.filter(booking => booking.serviceName === service.name);

                // Step - 5
                // Map ServiceBooking to get BookedSlots
                const bookedSlots = serviceBooking.map(book => book.slot);

                // Step - 6
                // Subtract the specific service slot from  service slots to get available
                const available = service.slots.filter(s => !bookedSlots.includes(s));
                service.slots = available;
            })
            res.send(services)
        })

        // Get all appointment of specific users
        app.get('/myappointments', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const email = req.query.email;
            const query = { patientEmail: email };
            const result = await bookingCollection.find(query).toArray();
            if (decodedEmail === email) {
                return res.send(result);
            }
            else {
                return res.status(403).send({ message: 'Forbidden' })
            }
        })

        // Get All User
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })


    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir)


app.listen(port, () => {
    console.log("server is runnning on port", port)
})