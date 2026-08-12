package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeploymentDocumentParserTest {
    @Test
    fun markdown_extractsContextAndCommands() {
        val draft = DeploymentDocumentParser.parse(
            "field-deploy.md",
            """
                # 现场采集服务部署

                ## 部署目标
                在离线现场部署采集服务。

                ## 服务器架构
                ARM64，2 台服务器。

                ## 操作系统
                麒麟 V10 SP3。

                ## 安装目录
                /opt/field-agent

                ## 备份与回退
                升级前备份 /data，失败后恢复上一版本。

                ```bash
                systemctl status field-agent --no-pager
                ```
            """.trimIndent(),
        )

        assertEquals("现场采集服务部署", draft.title)
        assertTrue(draft.context.architecture.contains("ARM64"))
        assertEquals("/opt/field-agent", draft.context.baseDirectory)
        assertEquals(1, draft.commands.size)
        assertTrue(draft.commands.single().command.contains("systemctl status"))
    }

    @Test
    fun json_extractsExplicitSchemaAndCommandArray() {
        val draft = DeploymentDocumentParser.parse(
            "agent-output.json",
            """
                {
                  "title": "矿区平台部署",
                  "deploymentContext": {
                    "architecture": "x86_64",
                    "operatingSystems": "Ubuntu 24.04",
                    "networkAccess": "完全离线"
                  },
                  "commands": [
                    {"title":"检查 Docker", "command":"docker version", "category":"Docker"}
                  ]
                }
            """.trimIndent(),
        )

        assertEquals("矿区平台部署", draft.title)
        assertEquals("完全离线", draft.context.networkAccess)
        assertEquals("Docker", draft.commands.single().category)
    }

    @Test
    fun fillMissingContext_preservesExistingFacts() {
        val current = DeploymentContext(architecture = "ARM64")
        val imported = DeploymentContext(architecture = "x86_64", operatingSystems = "麒麟 V10")

        val merged = current.fillMissingFrom(imported)

        assertEquals("ARM64", merged.architecture)
        assertEquals("麒麟 V10", merged.operatingSystems)
    }
}
