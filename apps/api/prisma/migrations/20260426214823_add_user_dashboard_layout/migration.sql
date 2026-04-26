-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dashboard_layout" TEXT[] DEFAULT ARRAY[]::TEXT[];
