package com.kllin.agnovexa.fieldos.domain

object CommandRiskClassifier {
    private val dangerousPatterns = listOf(
        "rm -rf", "mkfs", "dd if=", "drop database", "drop table", "truncate table",
        "shutdown", "reboot", "systemctl stop", "firewall-cmd", "iptables",
        "chmod -r 777", "chown -r", "docker system prune", "podman system prune",
    )
    private val cautionPatterns = listOf("sudo ", "systemctl restart", "kill ", "docker rm", "kubectl delete")

    fun classify(command: String): String {
        val normalized = command.lowercase().replace(Regex("\\s+"), " ").trim()
        return when {
            dangerousPatterns.any(normalized::contains) -> "DANGEROUS"
            cautionPatterns.any(normalized::contains) -> "CAUTION"
            else -> "SAFE"
        }
    }
}
