/*
  Warnings:

  - Added the required column `isActive` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `otp` to the `Admin` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Admin` ADD COLUMN `isActive` BOOLEAN NOT NULL,
    ADD COLUMN `otp` VARCHAR(191) NOT NULL;
