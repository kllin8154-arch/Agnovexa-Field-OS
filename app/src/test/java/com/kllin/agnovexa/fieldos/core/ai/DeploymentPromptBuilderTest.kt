package com.kllin.agnovexa.fieldos.core.ai

import com.kllin.agnovexa.fieldos.domain.DeploymentContext
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeploymentPromptBuilderTest {
    @Test
    fun emptyContext_requiresQuestionsAndMarksUnknownFields() {
        val prompt = DeploymentPromptBuilder.systemPrompt(DeploymentContext())

        assertTrue(prompt.contains("先用简短的编号问题逐项反问"))
        assertTrue(prompt.contains("CPU/服务器架构：未知"))
        assertFalse(prompt.contains("root 权限已具备"))
    }

    @Test
    fun configuredContext_isInjectedWithoutSecrets() {
        val prompt = DeploymentPromptBuilder.systemPrompt(
            DeploymentContext(
                deploymentGoal = "部署离线采集服务",
                architecture = "ARM64",
                operatingSystems = "麒麟 V10",
                baseDirectory = "/opt/field-os",
            ),
        )

        assertTrue(prompt.contains("部署离线采集服务"))
        assertTrue(prompt.contains("ARM64"))
        assertTrue(prompt.contains("/opt/field-os"))
        assertTrue(prompt.contains("不索取或复述密码"))
    }
}
