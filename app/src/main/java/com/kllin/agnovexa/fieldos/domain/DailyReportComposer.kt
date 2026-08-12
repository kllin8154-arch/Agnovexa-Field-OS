package com.kllin.agnovexa.fieldos.domain

object DailyReportComposer {
    data class Draft(
        val workContent: String,
        val problems: String,
        val solutions: String,
        val nextPlan: String,
        val risk: String,
    )

    fun compose(activities: List<Activity>): Draft {
        fun numbered(values: List<String>) = values.distinct().mapIndexed { index, value -> "${index + 1}. $value" }
            .joinToString("\n").ifBlank { "暂无记录" }

        val work = activities.filter { it.actionType in setOf("CREATED", "COMPLETED", "GENERATED") }
        val problems = activities.filter { it.entityType == "ISSUE" && it.actionType == "CREATED" }
        val solutions = activities.filter { it.entityType == "ISSUE" && it.actionType == "RESOLVED" }
        return Draft(
            workContent = numbered(work.map { it.title }),
            problems = numbered(problems.map { it.title }),
            solutions = numbered(solutions.map { it.description.ifBlank { it.title } }),
            nextPlan = "1. 复核未完成任务并安排下一步",
            risk = if (problems.isEmpty()) "暂无新增风险" else "仍有 ${problems.size} 项现场问题需要跟踪",
        )
    }
}
