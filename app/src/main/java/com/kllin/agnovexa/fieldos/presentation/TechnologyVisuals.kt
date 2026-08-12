package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import com.kllin.agnovexa.fieldos.R
import com.kllin.agnovexa.fieldos.domain.TechnologyCatalog

private val brandResources = mapOf(
    "nginx" to R.drawable.brand_nginx,
    "apachetomcat" to R.drawable.brand_apachetomcat,
    "postgresql" to R.drawable.brand_postgresql,
    "mysql" to R.drawable.brand_mysql,
    "mongodb" to R.drawable.brand_mongodb,
    "redis" to R.drawable.brand_redis,
    "rabbitmq" to R.drawable.brand_rabbitmq,
    "apachekafka" to R.drawable.brand_apachekafka,
    "docker" to R.drawable.brand_docker,
    "kubernetes" to R.drawable.brand_kubernetes,
    "openjdk" to R.drawable.brand_openjdk,
    "springboot" to R.drawable.brand_springboot,
    "python" to R.drawable.brand_python,
    "nodedotjs" to R.drawable.brand_nodedotjs,
    "git" to R.drawable.brand_git,
    "github" to R.drawable.brand_github,
    "gitlab" to R.drawable.brand_gitlab,
    "jenkins" to R.drawable.brand_jenkins,
    "prometheus" to R.drawable.brand_prometheus,
    "grafana" to R.drawable.brand_grafana,
    "elasticsearch" to R.drawable.brand_elasticsearch,
    "ubuntu" to R.drawable.brand_ubuntu,
)

private val brandColors = mapOf(
    "nginx" to Color(0xFF009639),
    "apachetomcat" to Color(0xFFF8B900),
    "postgresql" to Color(0xFF4169E1),
    "mysql" to Color(0xFF4479A1),
    "mongodb" to Color(0xFF47A248),
    "redis" to Color(0xFFFF4438),
    "rabbitmq" to Color(0xFFFF6600),
    "docker" to Color(0xFF2496ED),
    "kubernetes" to Color(0xFF326CE5),
    "openjdk" to Color(0xFFED8B00),
    "springboot" to Color(0xFF6DB33F),
    "python" to Color(0xFF3776AB),
    "nodedotjs" to Color(0xFF5FA04E),
    "git" to Color(0xFFF03C2E),
    "gitlab" to Color(0xFFFC6D26),
    "jenkins" to Color(0xFFD24939),
    "prometheus" to Color(0xFFE6522C),
    "grafana" to Color(0xFFF46800),
    "elasticsearch" to Color(0xFF00BFB3),
    "ubuntu" to Color(0xFFE95420),
)

@Composable
fun technologyAccent(technologyId: String): Color {
    val key = TechnologyCatalog.visualKey(technologyId)
    return when (key) {
        "github", "apachekafka" -> MaterialTheme.colorScheme.onSurface
        "system", "cpu", "generic" -> MaterialTheme.colorScheme.primary
        else -> brandColors[key] ?: MaterialTheme.colorScheme.primary
    }
}

@Composable
fun TechnologyIcon(
    technologyId: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
) {
    val key = TechnologyCatalog.visualKey(technologyId)
    val tint = technologyAccent(technologyId)
    val resource = brandResources[key]
    if (resource != null) {
        Icon(painterResource(resource), contentDescription, modifier = modifier, tint = tint)
    } else {
        val icon = when (key) {
            "system" -> Icons.Default.Computer
            "cpu" -> Icons.Default.Memory
            else -> Icons.Default.Extension
        }
        Icon(icon, contentDescription, modifier = modifier, tint = tint)
    }
}
