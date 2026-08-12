package com.kllin.agnovexa.fieldos.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.execSQL

@Database(
    entities = [
        ProjectEntity::class,
        TaskEntity::class,
        IssueEntity::class,
        ServerEntity::class,
        CommandEntity::class,
        KnowledgeEntity::class,
        SearchFtsEntity::class,
        ActivityLogEntity::class,
        DailyReportEntity::class,
        ProjectTechnologyEntity::class,
    ],
    version = 2,
    exportSchema = true,
)
abstract class FieldDatabase : RoomDatabase() {
    abstract fun fieldDao(): FieldDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(connection: androidx.sqlite.SQLiteConnection) {
                connection.execSQL(
                    "CREATE TABLE IF NOT EXISTS `project_technologies` (`projectId` TEXT NOT NULL, `technologyId` TEXT NOT NULL, PRIMARY KEY(`projectId`, `technologyId`))",
                )
                connection.execSQL("CREATE INDEX IF NOT EXISTS `index_project_technologies_projectId` ON `project_technologies` (`projectId`)")
                connection.execSQL("CREATE INDEX IF NOT EXISTS `index_project_technologies_technologyId` ON `project_technologies` (`technologyId`)")
            }
        }
    }
}
