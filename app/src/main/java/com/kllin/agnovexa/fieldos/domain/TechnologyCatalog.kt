package com.kllin.agnovexa.fieldos.domain

import java.util.Base64

data class TechnologyOption(val id: String, val name: String, val group: String)

object TechnologyCatalog {
    val all = listOf(
        TechnologyOption("nginx", "NGINX", "Web"),
        TechnologyOption("apachetomcat", "Tomcat", "Web"),
        TechnologyOption("openjdk", "OpenJDK", "运行时"),
        TechnologyOption("springboot", "Spring Boot", "运行时"),
        TechnologyOption("python", "Python", "运行时"),
        TechnologyOption("nodedotjs", "Node.js", "运行时"),
        TechnologyOption("postgresql", "PostgreSQL", "数据"),
        TechnologyOption("mysql", "MySQL", "数据"),
        TechnologyOption("mongodb", "MongoDB", "数据"),
        TechnologyOption("redis", "Redis", "数据"),
        TechnologyOption("rabbitmq", "RabbitMQ", "中间件"),
        TechnologyOption("apachekafka", "Kafka", "中间件"),
        TechnologyOption("docker", "Docker", "容器"),
        TechnologyOption("kubernetes", "Kubernetes", "容器"),
        TechnologyOption("ubuntu", "Ubuntu", "系统"),
        TechnologyOption("git", "Git", "研发运维"),
        TechnologyOption("github", "GitHub", "研发运维"),
        TechnologyOption("gitlab", "GitLab", "研发运维"),
        TechnologyOption("jenkins", "Jenkins", "研发运维"),
        TechnologyOption("prometheus", "Prometheus", "可观测"),
        TechnologyOption("grafana", "Grafana", "可观测"),
        TechnologyOption("elasticsearch", "Elasticsearch", "可观测"),
    )

    fun option(id: String): TechnologyOption? = all.firstOrNull { it.id == id } ?: customName(id)?.let {
        TechnologyOption(id, it, "自定义")
    }

    fun selectedOptions(ids: Set<String>): List<TechnologyOption> {
        val builtIn = all.filter { it.id in ids }
        val custom = ids.mapNotNull(::option).filter { it.id.startsWith(CUSTOM_PREFIX) }.sortedBy { it.name.lowercase() }
        return builtIn + custom
    }

    fun availableOptions(knownIds: Set<String>): List<TechnologyOption> = all + knownIds
        .filter { it.startsWith(CUSTOM_PREFIX) }
        .mapNotNull(::option)
        .distinctBy { it.id }
        .sortedBy { it.name.lowercase() }

    fun names(ids: Set<String>): List<String> = selectedOptions(ids).map { it.name }

    fun idForInput(value: String): String {
        val name = normalizeName(value)
        require(name.isNotBlank()) { "技术名称不能为空" }
        require(name.length <= 80) { "单项技术名称不能超过 80 个字符" }
        return all.firstOrNull { it.id.equals(name, true) || it.name.equals(name, true) }?.id
            ?: CUSTOM_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(name.toByteArray(Charsets.UTF_8))
    }

    fun idsForInput(value: String): Set<String> = value
        .split(Regex("[\n,，;；]+"))
        .map(String::trim)
        .filter(String::isNotBlank)
        .mapTo(linkedSetOf(), ::idForInput)

    fun isValidId(id: String): Boolean = all.any { it.id == id } || customName(id) != null

    fun visualKey(id: String): String {
        val value = option(id)?.let { "${it.id} ${it.name}" }?.lowercase().orEmpty()
        return when {
            "spring" in value -> "springboot"
            "tomcat" in value -> "apachetomcat"
            "openjdk" in value || "jdk" in value || "jre" in value || "java" in value -> "openjdk"
            "postgres" in value -> "postgresql"
            "mysql" in value -> "mysql"
            "mongo" in value -> "mongodb"
            "redis" in value -> "redis"
            "rabbit" in value -> "rabbitmq"
            "kafka" in value -> "apachekafka"
            "kubernetes" in value || "k8s" in value -> "kubernetes"
            "docker" in value -> "docker"
            "nginx" in value -> "nginx"
            "python" in value -> "python"
            "node" in value -> "nodedotjs"
            "gitlab" in value -> "gitlab"
            "github" in value -> "github"
            "jenkins" in value -> "jenkins"
            "prometheus" in value -> "prometheus"
            "grafana" in value -> "grafana"
            "elastic" in value -> "elasticsearch"
            "ubuntu" in value -> "ubuntu"
            "银河麒麟" in value || "kylin" in value || "linux" in value || "centos" in value ||
                "rocky" in value || "debian" in value || "统信" in value || "uos" in value -> "system"
            "arm" in value || "aarch" in value || "x86" in value || "amd64" in value -> "cpu"
            else -> all.firstOrNull { it.id in value }?.id ?: "generic"
        }
    }

    private fun customName(id: String): String? {
        if (!id.startsWith(CUSTOM_PREFIX)) return null
        return runCatching {
            Base64.getUrlDecoder().decode(id.removePrefix(CUSTOM_PREFIX)).toString(Charsets.UTF_8)
        }.getOrNull()?.let(::normalizeName)?.takeIf { it.isNotBlank() && it.length <= 80 }
    }

    private fun normalizeName(value: String): String = value.trim().replace(Regex("\\s+"), " ")

    private const val CUSTOM_PREFIX = "custom:"
}

object ProjectTechnologyDefaults {
    fun resolve(
        editingProjectId: String?,
        projects: List<Project>,
        selections: Map<String, Set<String>>,
        legacySelection: Set<String>,
    ): Set<String> {
        if (editingProjectId != null) return selections[editingProjectId].orEmpty()
        val recent = projects.firstNotNullOfOrNull { project -> selections[project.id]?.takeIf { it.isNotEmpty() } }
        return recent ?: legacySelection
    }
}
