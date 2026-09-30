import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./authRouter";
import { projectsRouter } from "./projectsRouter";
import { diagnosticsRouter } from "./diagnosticsRouter";
import { crawlRouter } from "./crawlRouter";
import { poolsRouter } from "./poolsRouter";
import { measurementsRouter } from "./measurementsRouter";
import { quotesRouter, schedulesRouter } from "./quotesRouter";
import { reportsRouter } from "./reportsRouter";
import { deliverablesRouter } from "./deliverablesRouter";
import { competitorsRouter } from "./competitorsRouter";
import { collectionRouter } from "./collectionRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  projects: projectsRouter,
  diagnostics: diagnosticsRouter,
  crawl: crawlRouter,
  pools: poolsRouter,
  measurements: measurementsRouter,
  quotes: quotesRouter,
  schedules: schedulesRouter,
  reports: reportsRouter,
  deliverables: deliverablesRouter,
  competitors: competitorsRouter,
  collection: collectionRouter,
});

export type AppRouter = typeof appRouter;
