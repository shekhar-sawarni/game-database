import 'dotenv/config'
import mongoose from 'mongoose'
import { env } from '../src/config/env.js'
import { UserModel } from '../src/models/user.js'
import bcrypt from 'bcryptjs'

async function ensureMongo(){
  if (!env.MONGO_URI) throw new Error('MONGO_URI not set')
  await mongoose.connect(env.MONGO_URI)
}

async function createUsers(n){
  const users = []
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS)
  const passwordHash = await bcrypt.hash('DemoPass123!', salt)
  for (let i=0;i<n;i++){
    const email = `player${i+1}@example.com`
    const userId = `${1000+i}`
    const existing = await UserModel.findOne({ email })
    const countryCode = i%2===0?'US':'IN'
    const region = i%3===0?'NA':'APAC'
    if (!existing){
      await UserModel.create({ userId, email, passwordHash, username: `player${i+1}`, countryCode, region })
    } else {
      const update = {}
      if (!existing.passwordHash) update.passwordHash = passwordHash
      if (!existing.username) update.username = `player${i+1}`
      if (!existing.countryCode) update.countryCode = countryCode
      if (!existing.region) update.region = region
      if (Object.keys(update).length>0){
        await UserModel.updateOne({ _id: existing._id }, { $set: update })
      }
    }
    users.push({ userId })
  }
  return users
}

async function postGame(mode, aUserId, bUserId, aScore, bScore){
  const body = {
    mode,
    countryCode: 'US',
    players: [
      { user_id: aUserId, score: aScore },
      { user_id: bUserId, score: bScore }
    ]
  }
  const res = await fetch('http://localhost:8000/event/game-result', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-api-key': (env.API_INGEST_KEYS?.[0]||'') }, body: JSON.stringify(body) })
  if (!res.ok){
    const txt = await res.text()
    console.error('postGame failed', res.status, txt)
  }
}

async function main(){
  await ensureMongo()
  const users = await createUsers(10)
  const mode = 'quiz'
  // Simulate a round-robin of games
  for (let i=0;i<users.length;i++){
    for (let j=i+1;j<users.length;j++){
      const a = users[i].userId
      const b = users[j].userId
      const aScore = Math.floor(800 + Math.random()*1200)
      const bScore = Math.floor(800 + Math.random()*1200)
      await postGame(mode, a, b, aScore, bScore)
    }
  }
  console.log('Demo games submitted. Check /leaderboard/quiz')
  await mongoose.disconnect()
}

main().catch(e=>{ console.error(e); process.exit(1) })


