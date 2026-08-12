package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertTrue
import org.junit.Test

class DailyReportComposerTest {
    @Test fun activitiesProduceStructuredReport() {
        val activities = listOf(
            Activity("1", "p", "TASK", "t", "CREATED", "新增部署任务", "", 1),
            Activity("2", "p", "ISSUE", "i", "CREATED", "Nginx 启动失败", "端口占用", 2),
            Activity("3", "p", "ISSUE", "i", "RESOLVED", "解决 Nginx 启动失败", "释放端口", 3),
        )

        val draft = DailyReportComposer.compose(activities)

        assertTrue(draft.workContent.contains("新增部署任务"))
        assertTrue(draft.problems.contains("Nginx 启动失败"))
        assertTrue(draft.solutions.contains("释放端口"))
    }

    @Test fun emptyActivitiesStillProduceReadableReport() {
        val draft = DailyReportComposer.compose(emptyList())
        assertTrue(draft.workContent.contains("暂无记录"))
        assertTrue(draft.risk.contains("暂无新增风险"))
    }
}
