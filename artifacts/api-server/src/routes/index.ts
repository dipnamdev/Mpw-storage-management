import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import commoditiesRouter from "./commodities";
import depositorsRouter from "./depositors";
import billsRouter from "./bills";
import approvalsRouter from "./approvals";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(commoditiesRouter);
router.use(depositorsRouter);
router.use(billsRouter);
router.use(approvalsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(uploadRouter);

export default router;
