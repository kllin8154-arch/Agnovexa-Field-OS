package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class ProjectTechnologyDefaultsTest {
    private val recent = Project("recent", "最近项目", "", "", "ACTIVE", 0, "", 2, 2)
    private val older = Project("older", "历史项目", "", "", "ACTIVE", 0, "", 1, 1)

    @Test
    fun newProject_inheritsMostRecentNonEmptySelection() {
        val result = ProjectTechnologyDefaults.resolve(
            editingProjectId = null,
            projects = listOf(recent, older),
            selections = mapOf(recent.id to setOf("docker", "nginx"), older.id to setOf("redis")),
            legacySelection = setOf("python"),
        )

        assertEquals(setOf("docker", "nginx"), result)
    }

    @Test
    fun existingProject_keepsItsOwnSelectionEvenWhenEmpty() {
        val result = ProjectTechnologyDefaults.resolve(
            editingProjectId = recent.id,
            projects = listOf(recent, older),
            selections = mapOf(older.id to setOf("redis")),
            legacySelection = setOf("python"),
        )

        assertEquals(emptySet<String>(), result)
    }

    @Test
    fun legacySelection_isFallbackWhenNoProjectHasHistory() {
        val result = ProjectTechnologyDefaults.resolve(null, listOf(recent), emptyMap(), setOf("python"))

        assertEquals(setOf("python"), result)
    }
}
