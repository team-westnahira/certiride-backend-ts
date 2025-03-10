/*
  Warnings:

  - You are about to alter the column `tokenValue` on the `authtoken` table. The data in that column could be lost. The data in that column will be cast from `VarChar(1024)` to `VarChar(512)`.

*/
-- AlterTable
ALTER TABLE `authtoken` MODIFY `tokenValue` VARCHAR(512) NOT NULL;
