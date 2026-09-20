import fp from "fastify-plugin"
import jwt from "@fastify/jwt"
import type { FastifyReply, FastifyRequest } from "fastify"
import { env } from "../env.js"

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string }
    user: { sub: string; email: string }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET, sign: { expiresIn: env.ACCESS_TOKEN_TTL } })
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.code(401).send({ message: "Unauthorized" })
    }
  })
})
