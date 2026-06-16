const express = require('express')
const cors = require('cors')
const app = express()
const port = 5000
require('dotenv').config()
app.use(cors())
app.use(express.json())
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const logger = (req, res, next) => {
  console.log("legger logged", req.params)
   next()
}




const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db('hireloop_db');
    const jobCollection = database.collection("jobs")
    const companyCollection = database.collection("companies")
    const userCollection = database.collection("user")
    const applicationsCollection = database.collection("applications")
    const planCollection = database.collection("plans")
    const subscriptionCollection = database.collection("subscriptions")
    const sessionCollection = database.collection("session")

    //verification related

    const verifyToken = async(req, res, next) =>{
  console.log(req.headers)
  const authHeader = req.headers?.authorization
  if(!authHeader){
     return res.status(401).send({mesaage: 'unauthorized access'})
  }
  const token = authHeader.split(' ')[1]
  if(!token){
    return res.status(401).send({mesaage: 'unauthorized access'})
  }

  const query = {token: token}
  const session = await sessionCollection.findOne(query)
   if(!session){
    return res.status(401).send({mesaage: 'unauthorized access'})
  }
  const userId = session.userId
  const userQuery = {
    _id: userId
  }
  const user = await userCollection.findOne(userQuery)
   if(!user){
    return res.status(401).send({mesaage: 'unauthorized access'})
  }
  req.user = user
   next()
}
const verifySeeker = async(req, res, next)=>{
  if(req.user?.role !== "seeker"){
   return res.status(403).send({message: 'forbidden access'})
  }
     next()
}

const verifyRecruiter = async(req, res, next)=>{
     if(req.user?.role !== "recruiter"){
        return res.status(403).send({message: 'forbidden access'})
     }
     next()
}
const verifyAdmin = async(req, res, next)=>{
     if(req.user?.role !== "admin"){
        return res.status(403).send({message: 'forbidden access'})
     }
     next()
}
   //chatgpt
   app.post("/api/set-user-role", async (req, res) => {
  const { email, role } = req.body;

  await userCollection.updateOne(
    { email },
    {
      $set: {
        role,
        plan: role === "recruiter" ? "recruiter_free" : "seeker_free"
      }
    }
  );

  res.send({ success: true });
});
  //jobs releated api
     app.get("/api/jobs", async(req, res)=>{
        const query = {}
        //job related query
        if(req.query.search){
          query.$or = [
            {jobTitle : {$regex: req.query.search, $options: 'i'}},
            {companyName : {$regex: req.query.search, $options: 'i'}}
          ]
        }
        if(req.query.jobType){
          query.jobType = req.query.jobType
        }
        if(req.query.jobCategory){
          query.jobCategory = req.query.jobCategory
        }
        if(req.query.isRemote !== undefined){
  query.isRemote = req.query.isRemote === "true";
}
     
        //company related query
        if (req.query.companyId){
         query.companyId = req.query.companyId
        } 
        if(req.query.status){
            query.status = req.query.status
        }

         //pagination related query
      if(req.query.page){
        const page = req.query.page
        const perPage = req.query.perPage || 9
        const skipItems = (page - 1)*perPage
        const total = await jobCollection.countDocuments(query)
         const cursor = jobCollection.find(query).skip(skipItems).limit(perPage)
        const jobs = await cursor.toArray()
        return res.send({total, jobs})
      }
        const cursor = jobCollection.find(query)
        const result = await cursor.toArray()
        res.send(result)
    })

    app.get("/api/jobs/:id", async(req, res)=>{
      const id = req.params.id
    const query = { _id: new ObjectId(id)}
      const result = await jobCollection.findOne(query)
      res.send(result)
    })

    app.post("/api/jobs", async(req, res)=>{
        const job = req.body;
        const newJob = {
          ...job,
          createdAt: new Date()
        }
        const result = await jobCollection.insertOne(newJob);
        res.send(result)
    })

    //application 
    app.get("/api/applications", verifyToken, verifySeeker, async(req, res)=>{
      const query = {}
      if(req.query.applicantId){
        query.applicantId = req.query.applicantId
        if(req.user._id.toString()!== req.query.applicantId){
          return res.status(403).send({mesaage: "forbidden access"})
        }
      }
      if(req.query.jobId){
        query.jobId = req.query.jobId
      }
      const cursor = applicationsCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })
    app.post("/api/applications", async(req, res)=>{
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date()
      }
      const result = await applicationsCollection.insertOne(newApplication)
      res.send(result)
    })

    //company related apis
    app.get("/api/companies", verifyToken, async(req, res)=>{
      const cursor = companyCollection.find()
      const companies = await cursor.toArray()
      for(const company of companies){
        const filter = {
          companyId: company._id.toString()
        }
        const jobCount = await jobCollection.countDocuments(filter)
        company.jobCount = jobCount
      }
      res.send(companies)
    })
    app.get("/api/my/companies", async(req, res)=>{
       const query = {}
      if(req.query.recruiterId){
        query.recruiterId = req.query.recruiterId
      
      }
      const result = await companyCollection.findOne(query)
      res.send(result || {})
      
    })

    app.post("/api/companies", async(req, res)=>{
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date()
      }
      const result = await companyCollection.insertOne(newCompany)
      res.send(result)
    })

    app.patch("/api/companies/:id", logger, verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id
      const updatedCompany = req.body;
      const filter = {_id: new ObjectId(id)} 
      const updateDoc = {
      $set: {
       status: updatedCompany.status 
      },
    };
    const result = await companyCollection.updateOne(filter, updateDoc)
    res.send(result)

    })

    //plans

    app.get("/api/plans", async(req, res)=>{
      const query = {}
      if(req.query.plan_id){
        query.id = req.query.plan_id
      }
      const plan = await planCollection.findOne(query)
      res.send(plan)
    })

    //subscription
    app.post("/api/subscriptions", async(req, res)=>{
        const data = req.body
        const subsInfo = {
          ...data,
          createdAt: new Date()
        }
        const result = await subscriptionCollection.insertOne(subsInfo)
        //update user info
        const filter = {email: data.email}
        const updateDocument = {
      $set: {
        plan: data.planId,
      }
     }
     const updateResult = await userCollection.updateOne(filter, updateDocument)
        res.send(updateResult)
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})