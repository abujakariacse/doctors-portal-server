const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.b8yrs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {

    try {
        await client.connect()
        const serviceCollection = client.db('doctors-portal').collection('service');
        const bookingCollection = client.db('doctors-portal').collection('bookings');

        // To check server is running or not on browser
        app.get('/', (req, res) => {
            res.send('Server is running.....')
        })

        // Get all services
        app.get('/service', async (req, res) => {
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


    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir)


app.listen(port, () => {
    console.log("server is runnning on port", port)
})