const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASSWORD}@cluster0.3dm7fqv.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    console.log('token', req.headers.authorization)
    const authHeader=req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('unauthorized access')

    }
    const token =authHeader.split(' ')[1]
    jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
        if(err){
            return res.status(403).send({message:'forbidden access'})
        }
        req.decoded=decoded;
        next();
    })
}


async function run() {
    try {
        const appointMentCollection = client.db('doctorsPortal').collection('appoinmentOptions')
        const bookingsCollection = client.db('doctorsPortal').collection('bookings')
        const usersCollection = client.db('doctorsPortal').collection('users')
        const doctorsCollection = client.db('doctorsPortal').collection('doctors')

        const verifyAdmin= async(req,res,next)=>{
            const decodedEmail=req.decoded.email;
            const filter={email:decodedEmail};
            const user=await usersCollection.findOne(filter);
            if(user?.role !== 'Admin'){
                return res.status(403).send({message:'forbidden access'})
            }

           next()
        }

        app.get('/availableOptions', async (req, res) => {
            const bookDate = req.query.date
            const query = {}
            const results = await appointMentCollection.find(query).toArray()
            const bookingQuery = { Date: bookDate }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()
            // codemaster
            results.forEach(result => {
                const optionBooked = alreadyBooked.filter(book => book.treatMent == result.name)
                const bookedSlot = optionBooked.map(book => book.slot)
                const remainSlots = result.slots.filter(slot => !bookedSlot.includes(slot))
                result.slots = remainSlots
            });
            res.send(results)
        });
        app.get('/appointmentSpecialty',async(req,res)=>{
            const query={}
            const result =await appointMentCollection.find(query).project({name:1}).toArray();
            res.send(result)
        });
        app.post('/dashboard/addDoctor',verifyJWT,verifyAdmin,async(req,res)=>{
            const data=req.body;
            const result=await doctorsCollection.insertOne(data);
            res.send(result)
        }),
        app.get('/dashboard/doctors',verifyJWT,verifyAdmin,async(req,res)=>{
            const query={}
            const result=await doctorsCollection.find(query).toArray();
            res.send(result)
        });
        app.delete('/dashboard/doctors/:id',verifyJWT,verifyAdmin,async(req,res)=>{
            const id=req.params.id;
            const query={_id:ObjectId(id)}
            const result =await doctorsCollection.deleteOne(query);
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {
            const data = req.body
            console.log(data);
            const query = {
                Date: data.Date,
                email: data.email,
                treatMent: data.treatMent
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `You Already have a Booking on ${data.Date}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(data)
            res.send(result)
        });
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail=req.decoded.email;
            if(email!==decodedEmail){
                return res.status(403).send({message:'forbidden access'})
            }
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        });

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })
        });
        app.get('/users/admin/:email',async(req,res)=>{
            const email=req.params.email;
            const query={email}
            const user=await usersCollection.findOne(query);
            res.send({isAdmin: user?.role =='Admin'})
        });


        app.get('/users',async(req,res)=>{
            const query={}
            const result=await usersCollection.find(query).toArray();
            res.send(result)
        });
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result)
        });
        app.put('/users/admin/:id',verifyJWT,async(req,res)=>{
           


            const id=req.params.id;
            const query={_id:ObjectId(id)};
            const options={upsert:true};
            const updateDoc={
                $set:{role:'Admin'}
            }
            const result= await usersCollection.updateOne(query,updateDoc,options);
            res.send(result)

        })

    }


    finally { }
}
run().catch(error => console.log(error))







app.get('/', (req, res) => {
    res.send('doctors portal server is running')
})

app.listen(port, () => console.log(`Doctors portal is running on port :${port}`))