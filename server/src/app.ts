import { Router } from "express";
import pilotRouter from "./routes/health";

export function createAppRouter(): Router {
  const router = Router();

  // Mount pilot routes under /pilot. Real app will mount this under /api.
  router.use("/pilot", pilotRouter);

  return router;
}

export default createAppRouter;
