package com.kllin.agnovexa.fieldos.di

import android.content.Context
import androidx.room.Room
import com.kllin.agnovexa.fieldos.core.database.FieldDao
import com.kllin.agnovexa.fieldos.core.database.FieldDatabase
import com.kllin.agnovexa.fieldos.data.FieldRepositoryImpl
import com.kllin.agnovexa.fieldos.domain.FieldRepository
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides @Singleton
    fun database(@ApplicationContext context: Context): FieldDatabase =
        Room.databaseBuilder(context, FieldDatabase::class.java, "agnovexa-field-os.db")
            .addMigrations(FieldDatabase.MIGRATION_1_2)
            .build()

    @Provides fun dao(database: FieldDatabase): FieldDao = database.fieldDao()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun repository(impl: FieldRepositoryImpl): FieldRepository
}
