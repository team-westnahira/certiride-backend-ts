/*
  Warnings:

  - Added the required column `category` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `extractedData` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `file` ADD COLUMN `category` VARCHAR(191) NOT NULL,
    ADD COLUMN `extractedData` VARCHAR(191) NOT NULL;
