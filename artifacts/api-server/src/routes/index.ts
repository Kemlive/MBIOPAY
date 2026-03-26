import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import walletRouter from "./wallet";
import authRouter from "./auth";
import profileRouter from "./profile";
import twofaRouter from "./twofa";
import adminRouter from "./admin";
import adminAuthRouter from "./adminAuth";
import activityRouter from "./activity";
import trackingRouter from "./tracking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(activityRouter);
router.use(walletRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(twofaRouter);
router.use(ordersRouter);
router.use(adminAuthRouter);
router.use(adminRouter);
router.use(trackingRouter);

export default router;
