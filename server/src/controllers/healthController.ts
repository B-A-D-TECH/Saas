import { Request, Response } from "express";
import * as healthService from "../services/healthService";

export async function getHealth(_req: Request, res: Response) {
  try {
    const status = await healthService.getHealth();
    res.json(status);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
