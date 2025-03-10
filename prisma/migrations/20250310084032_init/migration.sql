-- CreateTable
CREATE TABLE `VehicleOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `nic` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `verificationStatus` BOOLEAN NOT NULL,
    `otp` VARCHAR(191) NOT NULL,
    `dateRegistered` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VehicleOwner_phone_key`(`phone`),
    UNIQUE INDEX `VehicleOwner_nic_key`(`nic`),
    UNIQUE INDEX `VehicleOwner_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `eventId` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin` (
    `adminId` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Admin_email_key`(`email`),
    PRIMARY KEY (`adminId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mechanic` (
    `mechanicId` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nic` VARCHAR(191) NOT NULL,
    `cid` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `dateRegistered` DATETIME(3) NOT NULL,
    `specialization` VARCHAR(191) NOT NULL,
    `verificationStatus` BOOLEAN NOT NULL,

    UNIQUE INDEX `Mechanic_email_key`(`email`),
    UNIQUE INDEX `Mechanic_nic_key`(`nic`),
    UNIQUE INDEX `Mechanic_cid_key`(`cid`),
    UNIQUE INDEX `Mechanic_phone_key`(`phone`),
    PRIMARY KEY (`mechanicId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `tokenId` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenValue` VARCHAR(1024) NOT NULL,
    `userId` INTEGER NOT NULL,
    `userRole` VARCHAR(191) NOT NULL,
    `tokenType` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NOT NULL,
    `deviceInfo` VARCHAR(191) NOT NULL,
    `expirationTime` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuthToken_tokenValue_key`(`tokenValue`),
    PRIMARY KEY (`tokenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `notificationId` INTEGER NOT NULL AUTO_INCREMENT,
    `notificationType` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `userRole` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `read` BOOLEAN NOT NULL,

    PRIMARY KEY (`notificationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `vehicleId` INTEGER NOT NULL AUTO_INCREMENT,
    `vin` VARCHAR(191) NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `manufacture` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `year` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_vin_key`(`vin`),
    PRIMARY KEY (`vehicleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `reportId` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `genaratedDate` DATETIME(3) NOT NULL,
    `reportType` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`reportId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispute` (
    `disputeId` INTEGER NOT NULL AUTO_INCREMENT,
    `serviceDate` DATETIME(3) NOT NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `mechanicId` INTEGER NOT NULL,
    `status` BOOLEAN NOT NULL,
    `reviewedBy` INTEGER NOT NULL,
    `discription` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`disputeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
