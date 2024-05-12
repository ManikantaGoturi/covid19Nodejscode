const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

intilizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log('DB Error:${e.message}')
    process.exit(-1)
  }
}

intilizeDbAndServer()

const convertstateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertdistrictDbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_KEY', (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const databaseUser = await db.get(selectUserQuery)
  if (databaseUser === undefined) {
    resposne.status(400)
    response.send('Invalid user')
  } else {
    isPasswordMatched = await bcrypt.compare(password, databaseUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', async (request, response) => {
  const getstateQuery = `
  SELECT * FROM state;
  `
  const stateArray = await db.all(getstateQuery)
  response.send(
    stateArray.map(eachstate =>
      convertstateDbObjectToResponseObject(eachstate),
    ),
  )
})

app.get('/states/:stateId/', async (request, response) => {
  const {stateId} = request.params

  const getStateQuery = `
  SELECT 
  *
  FROM 
  state
  WHERE 
  state_id = ${stateId};
  `
  const state = await db.get(getStateQuery)
  response.send(convertstateDbObjectToResponseObject(state))
})

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictsQuery = `
  SELECT 
  *
  FROM 
  district 
  WHERE
  district_id = ${districtId};
  `
    const district = await db.get(getDistrictsQuery)
    response.send(convertdistrictDbObjectToResponseObject(district))
  },
)

app.post('/districts/', async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = request.body
  const postQuery = `
  INSERT INTO district(state_id, district_name, cases, cured, active, deaths)
  VALUES
  (${stateId},'${districtName}',${cases},${cured},${active},${deaths});
  `
  await db.run(postQuery)
  response.send('District Successfully Added')
})

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM district WHERE district_id = ${districtId}
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `
  UPDATE
  district 
  SET 
  district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  WHERE
  district_id = ${districtId} ;
  `
    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

app.get(
  ' /states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getstateQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths),
  FROM 
  state
  FROM
   district 
  WHERE
    state_id = ${stateId}
  `
    const state = await db.get(getstateQuery)
    response.send({
      totalCases: state['SUM(cases)'],
      totalCured: state['SUM(cured)'],
      totalActive: state['SUM(active)'],
      totalDeaths: state['SUM(deaths)'],
    })
  },
)

module.exports = app
