import Fastify from 'fastify'
import cors from '@fastify/cors'
import { paymentRoutes } from './routes/payment.js'
import { generationRoutes } from './routes/generation.js'

const app = Fastify({ logger: true })

// CORS - aceitar apenas frontend
const allowedOrigins = [
  'https://musiclovely.com',
  'https://www.musiclovely.com',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  'http://localhost:5173',
  'http://localhost:8084'
].filter((origin): origin is string => typeof origin === 'string')

await app.register(cors, { 
  origin: allowedOrigins
})

// Health check
app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

// Registrar rotas
await app.register(paymentRoutes)
await app.register(generationRoutes)

// Iniciar servidor
const port = Number(process.env.PORT) || 3000
app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`🚀 Backend rodando na porta ${port}`)
})

