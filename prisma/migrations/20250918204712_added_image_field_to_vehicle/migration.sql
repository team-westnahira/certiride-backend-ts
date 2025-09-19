/*
  Warnings:

  - Added the required column `vehicleImage` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Vehicle` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `vehicleImage` VARCHAR(191) NOT NULL;
