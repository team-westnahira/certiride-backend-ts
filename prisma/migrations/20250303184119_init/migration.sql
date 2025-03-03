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
    `DateRegistered` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VehicleOwner_phone_key`(`phone`),
    UNIQUE INDEX `VehicleOwner_nic_key`(`nic`),
    UNIQUE INDEX `VehicleOwner_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
