const express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
const NodeCache = require('node-cache')

const app = express()
const port = 3000;

app.use(cors()) // allow CORS requests
app.use(bodyParser.json()) // parse application/json

const appliedTeamsCache = new NodeCache({ stdTTL: 10 })

app.post('/coach/apply-teams', (req, res) => {
  const coach = req.body.coach
  const teams = req.body.teams

  appliedTeamsCache.set(
    coach.name,
    {
      coach: coach,
      teams: teams
    }
  )

  let matchupData = {teams: [], coaches: []}

  for (const oppCoachName of appliedTeamsCache.keys()) {
    if (oppCoachName === coach.name) {
      continue
    }

    const oppCoachTeams = appliedTeamsCache.get(oppCoachName)
    if (oppCoachTeams === undefined) {
      continue
    }

    matchupData.coaches.push(oppCoachTeams.coach)

    for (const oppCoachTeam of oppCoachTeams.teams) {
      matchupData.teams.push(
        {
          id: oppCoachTeam.id,
          name: oppCoachTeam.name,
          race: oppCoachTeam.race,
          teamValue: oppCoachTeam.teamValue,
          division: oppCoachTeam.division,
          coachId: oppCoachTeams.coach.id,
          offers: oppCoachTeam.offers,
          rejections: oppCoachTeam.rejections,
          isActivated: oppCoachTeam.isActivated
        }
      )
    }
  }

  res.send(matchupData)
})

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})