-- CreateEnum
CREATE TYPE "ScheduleWeekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');

-- CreateTable
CREATE TABLE "student_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_schedule_entries" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "weekday" "ScheduleWeekday" NOT NULL,
    "period_number" INTEGER NOT NULL,
    "class_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_schedule_friends" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "friend_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_schedule_friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_day_blocks" (
    "id" TEXT NOT NULL,
    "weekday" "ScheduleWeekday" NOT NULL,
    "label" TEXT NOT NULL,
    "period_number" INTEGER,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_day_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_schedules_user_id_key" ON "student_schedules"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_schedule_entries_schedule_id_weekday_period_number_key" ON "student_schedule_entries"("schedule_id", "weekday", "period_number");

-- CreateIndex
CREATE UNIQUE INDEX "student_schedule_friends_owner_id_friend_id_key" ON "student_schedule_friends"("owner_id", "friend_id");

-- CreateIndex
CREATE INDEX "school_day_blocks_weekday_start_time_idx" ON "school_day_blocks"("weekday", "start_time");

-- AddForeignKey
ALTER TABLE "student_schedules" ADD CONSTRAINT "student_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_entries" ADD CONSTRAINT "student_schedule_entries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "student_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_friends" ADD CONSTRAINT "student_schedule_friends_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_friends" ADD CONSTRAINT "student_schedule_friends_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_day_blocks" ADD CONSTRAINT "school_day_blocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
