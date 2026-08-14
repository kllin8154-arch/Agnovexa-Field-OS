package com.kllin.agnovexa.fieldos.core.database

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.kllin.agnovexa.fieldos.data.FieldRepositoryImpl
import com.kllin.agnovexa.fieldos.domain.DeploymentExampleCatalog
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FieldDatabaseTest {
    private lateinit var database: FieldDatabase
    private lateinit var dao: FieldDao

    @Before fun setUp() {
        database = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), FieldDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = database.fieldDao()
    }

    @After fun tearDown() = database.close()

    @Test fun projectCrudWorks() = runTest {
        val project = ProjectEntity("p1", "现场项目", "PX", "描述", "ACTIVE", 20, "郴州", 1, 1)
        dao.upsertProject(project)
        assertEquals(project, dao.observeProjects().first().single())
    }

    @Test fun commandAndKnowledgeFtsSearchWorks() = runTest {
        dao.index(SearchFtsEntity("c1", "COMMAND", "检查 Nginx", "systemctl status nginx", "nginx"))
        dao.index(SearchFtsEntity("k1", "KNOWLEDGE", "Redis 排查", "缓存连接超时", "redis"))
        val result = dao.search("nginx*", 10)
        assertEquals(1, result.size)
        assertTrue(result.single().title.contains("Nginx"))
    }

    @Test fun projectTechnologySelectionIsIndependent() = runTest {
        dao.upsertProject(ProjectEntity("p1", "项目一", "", "", "ACTIVE", 0, "", 1, 1))
        dao.upsertProject(ProjectEntity("p2", "项目二", "", "", "ACTIVE", 0, "", 1, 1))
        dao.upsertProjectTechnologies(
            listOf(
                ProjectTechnologyEntity("p1", "docker"),
                ProjectTechnologyEntity("p1", "nginx"),
                ProjectTechnologyEntity("p2", "python"),
            ),
        )

        val selections = dao.observeProjectTechnologies().first().groupBy { it.projectId }
        assertEquals(setOf("docker", "nginx"), selections.getValue("p1").map { it.technologyId }.toSet())
        assertEquals(setOf("python"), selections.getValue("p2").map { it.technologyId }.toSet())
    }

    @Test fun deploymentExampleInstallsAsLinkedWorkspaceData() = runTest {
        FieldRepositoryImpl(database, dao).installDeploymentExample()

        assertEquals(DeploymentExampleCatalog.PROJECT_ID, dao.allProjects().single().id)
        assertEquals(7, dao.allTasks().size)
        assertTrue(dao.allServers().all { it.projectId == DeploymentExampleCatalog.PROJECT_ID })
        assertTrue(dao.allIssues().all { issue -> dao.allServers().any { it.id == issue.serverId } })
        assertTrue(dao.search("部署示例*", 20).isNotEmpty())
        assertEquals(1, dao.allReports().size)
    }
}
