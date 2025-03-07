-- CreateTable
CREATE TABLE `AuditLog` (
    `eventId` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
