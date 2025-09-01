import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { env } from '../src/config/env.js'
import { UserModel } from '../src/models/user.js'

async function main(){
  if (!env.MONGO_URI) throw new Error('MONGO_URI not set')
  await mongoose.connect(env.MONGO_URI)
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS)
  const passwordHash = await bcrypt.hash('SeedUser#123', salt)
  const bulk = []
  for (let i=1;i<=1000;i++){
    const userId = String(100000 + i)
    const email = `seed${i}@example.com`
    const username = `seed_user_${i}`
    const countryCode = i%2===0?'US':'IN'
    const region = i%3===0?'NA':'APAC'
    bulk.push({ updateOne: { filter: { email }, update: { $setOnInsert: { userId, email, passwordHash, username, countryCode, region } }, upsert: true } })
  }
  if (bulk.length) await UserModel.bulkWrite(bulk, { ordered: false })
  console.log('Seeded 1000 users (upsert).')
  await mongoose.disconnect()
}

main().catch(e=>{ console.error(e); process.exit(1) })


