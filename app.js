const express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
const NodeCache = require('node-cache')
const moment = require('moment')

const app = express()
const port = 3000;

app.use(cors()) // allow CORS requests
app.use(bodyParser.json()) // parse application/json

const gameFinderAppliedCache = new NodeCache({ stdTTL: 10 })

let blackboxDrawId = 1
let blackboxLastDrawDate = moment()
const blackboxDrawFrequencyInMinutes = 1
const blackboxAppliedCache = new NodeCache({ stdTTL: 3600 }) // only hold long enough till the draw is made
const blackboxDrawCache = new NodeCache({ stdTTL: 7200 }) // hold for a couple of hours

function getRandomInteger(max) {
  return Math.floor(Math.random() * max)
}

function getRandomArrayElement(array) {
  return array[getRandomInteger(array.length)]
}

setInterval(function () {
  const blackboxDrawTeams = []
  for (const coachName of blackboxAppliedCache.keys()) {
    const blackboxApplication = blackboxAppliedCache.get(coachName)
    if (blackboxApplication.teams.length > 0) {
      blackboxDrawTeams.push({
        coachName: coachName,
        team: getRandomArrayElement(blackboxApplication.teams)
      })
    }
  }

  let newPair = true
  let team1;
  let team2;
  const blackboxMatches = []
  for (const coachSettings of blackboxDrawTeams) {
    if (newPair) {
      team1 = coachSettings
      newPair = false
    } else {
      team2 = coachSettings

      if (team1 && team2) {
        blackboxMatches.push({
          home: team1,
          away: team2
        })
      }

      team1 = null
      team2 = null
      newPair = true
    }
  }

  // only create a draw entry if a match up was made
  if (blackboxMatches.length > 0) {
    const drawKey = moment().format('YYYY-MM-DD-HH-mm')
    blackboxDrawCache.set(drawKey, {drawKey: drawKey, date: new Date(), matches: blackboxMatches})
  }

  // increment the draw id so the UI knows its not on the active one anymore
  blackboxDrawId++

  // reset the applied teams
  blackboxAppliedCache.flushAll()

  // record when the last draw took place, even if no-one was matched up
  blackboxLastDrawDate = moment()

}, blackboxDrawFrequencyInMinutes * 60000)

app.post('/blackbox/activate', (req, res) => {
  const coach = req.body.coach
  const teams = req.body.teams

  blackboxAppliedCache.set(
    coach.name,
    {
      coach: coach,
      teams: teams
    }
  )

  res.send({drawId: blackboxDrawId, teamCount: teams.length})
})

app.post('/blackbox/deactivate', (req, res) => {
  const coach = req.body.coach

  const deleteResult = blackboxAppliedCache.del(coach.name)

  res.send({coachRemoved: deleteResult})
})

function getBlackboxCurrentInfo() {
  let coachCount = 0
  let teamCount = 0
  const timeOfNextDraw = blackboxLastDrawDate.clone().add(blackboxDrawFrequencyInMinutes, 'minutes');

  for (const coachName of blackboxAppliedCache.keys()) {
    const blackboxApplication = blackboxAppliedCache.get(coachName)
    if (blackboxApplication.teams.length > 0) {
      coachCount++
    }
    teamCount += blackboxApplication.teams.length
  }

  return {
    drawId: blackboxDrawId,
    coachCount: coachCount,
    teamCount: teamCount,
    timeOfNextDraw: timeOfNextDraw
  }
}

function getBlackboxDrawResults() {
  const blackboxDrawCacheKeys = blackboxDrawCache.keys()

  blackboxDrawCacheKeys.sort(function (a, b) {
    if (a == b) {
      return 0
    } else if (a < b) {
      return 1
    } else {
      return -1;
    }
  })

  const results = []

  for (const blackboxDrawCacheKey of blackboxDrawCacheKeys) {
    const drawResult = blackboxDrawCache.get(blackboxDrawCacheKey)
    if (drawResult !== undefined) {
      results.push(drawResult)
    }
  }

  return results
}

app.get('/blackbox/latest', (req, res) => {
  res.send({
    currentInfo: getBlackboxCurrentInfo(),
    drawResults: getBlackboxDrawResults()
  })
})

app.post('/game-finder/apply', (req, res) => {
  const gameFinderCoachRequest = req.body

  gameFinderAppliedCache.set(
    gameFinderCoachRequest.coach.name,
    gameFinderCoachRequest
  )

  const opponentGameFinderCoachRequests = []

  for (const oppCoachName of gameFinderAppliedCache.keys()) {
    if (oppCoachName === gameFinderCoachRequest.coach.name) {
      continue
    }

    let opponentGameFinderCoachRequest = gameFinderAppliedCache.get(oppCoachName)
    if (opponentGameFinderCoachRequest !== undefined) {
      opponentGameFinderCoachRequests.push(opponentGameFinderCoachRequest)
    }
  }

  res.send(opponentGameFinderCoachRequests)
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})