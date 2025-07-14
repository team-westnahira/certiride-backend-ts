import express from 'express';
import vehicleOwnerRoutes from '../controllers/vehicleowner.controller';
import mechanicRoutes from '../controllers/mechanic.controller';
import auditLogRoutes from '../controllers/auditlog.controller';
import adminAuth from '../controllers/auth/admin-auth.controller';
import mechanicAuth from '../controllers/auth/mechanic-auth.controller';
import vehicleOwnerAuth from '../controllers/auth/vehicle-owner-auth.controller';
import vehicleController from '../controllers/vehicle.controller';
import interactionController from '../controllers/interaction/interaction.controller';
import diagnosticController from '../controllers/interaction/diagnostic.controller';
import invoiceController from '../controllers/interaction/invoice.controller';
import resetPasswordController from '../controllers/auth/reset-password.controller';
import manageDocumentsController from '../controllers/documents.controller';
import notificationController from '../controllers/notification.controller';


const router = express.Router();

router.use('/vehicle-owner', vehicleOwnerRoutes);
router.use('/mechanic', mechanicRoutes);
router.use('/audit-log', auditLogRoutes);

router.use('/auth/admin', adminAuth);
router.use('/auth/mechanic', mechanicAuth);
router.use('/auth/vehicle-owner', vehicleOwnerAuth);

router.use('/auth/reset-passsword', resetPasswordController);

router.use('/vehicle', vehicleController);
router.use('/manage-docs', manageDocumentsController);
router.use('/interaction', interactionController);
router.use('/interaction/diagnostic', diagnosticController);
router.use('/interaction/invoice', invoiceController);

router.use('/notification', notificationController);


export default router;
