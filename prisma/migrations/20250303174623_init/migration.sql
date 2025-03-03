/*
  Warnings:

  - Added the required column `otp` to the `VehicleOwner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `vehicleowner` ADD COLUMN `otp` VARCHAR(191) NOT NULL;
