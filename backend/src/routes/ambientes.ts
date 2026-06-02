import type { FastifyInstance } from "fastify";
import { getAmbienteBrandingBySlug } from "../services/ambientes.service.js";

const pSlug = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
  },
  required: ["slug"],
};

export async function ambientePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/ambientes/:slug/branding",
    {
      schema: {
        tags: ["Ambientes"],
        summary: "Carrega branding publico do ambiente por slug",
        params: pSlug,
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      return reply.send(await getAmbienteBrandingBySlug(slug));
    },
  );
}
