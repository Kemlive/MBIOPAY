import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import walletRouter from "./wallet";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(authRouter);
router.use(ordersRouter);

export default router;
