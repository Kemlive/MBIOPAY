import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(ordersRouter);

export default router;
