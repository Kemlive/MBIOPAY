import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import walletRouter from "./wallet";
import authRouter from "./auth";
import profileRouter from "./profile";
import adminRouter from "./admin";
import adminAuthRouter from "./adminAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(ordersRouter);
router.use(adminAuthRouter);
router.use(adminRouter);

export default router;
