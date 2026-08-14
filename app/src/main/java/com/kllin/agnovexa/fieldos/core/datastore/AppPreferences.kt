package com.kllin.agnovexa.fieldos.core.datastore

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.kllin.agnovexa.fieldos.core.ai.OpenAiCompatibleClient
import com.kllin.agnovexa.fieldos.core.ai.ModelLifecycleRegistry
import com.kllin.agnovexa.fieldos.core.security.SecretStore
import com.kllin.agnovexa.fieldos.domain.AiProvider
import com.kllin.agnovexa.fieldos.domain.DeploymentContext
import com.kllin.agnovexa.fieldos.domain.ThemeMode
import com.kllin.agnovexa.fieldos.domain.ThemePreset
import com.kllin.agnovexa.fieldos.domain.ThemeTokens
import com.kllin.agnovexa.fieldos.domain.UserPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.dataStore by preferencesDataStore("agnovexa_preferences")

@Singleton
class AppPreferences @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val secrets: SecretStore,
) {
    private val userNameKey = stringPreferencesKey("user_name")
    private val themeModeKey = stringPreferencesKey("theme_mode")
    private val legacyCustomThemeKey = stringPreferencesKey("custom_theme")
    private val themesKey = stringPreferencesKey("theme_library")
    private val selectedThemeKey = stringPreferencesKey("selected_theme_id")
    private val providersKey = stringPreferencesKey("ai_providers")
    private val selectedProviderKey = stringPreferencesKey("selected_ai_provider_id")
    private val selectedAiProjectKey = stringPreferencesKey("selected_ai_project_id")
    private val selectedTechnologiesKey = stringSetPreferencesKey("selected_technologies")
    private val deploymentContextKey = stringPreferencesKey("deployment_context")

    val values: Flow<UserPreferences> = context.dataStore.data.map { prefs ->
        val themes = parseThemes(prefs[themesKey]).toMutableList()
        if (themes.isEmpty()) {
            prefs[legacyCustomThemeKey]?.let { legacy ->
                parseThemeOrNull(legacy)?.let { tokens ->
                    themes += ThemePreset("legacy", tokens, legacy, 0L, 0L)
                }
            }
        }
        val selectedThemeId = prefs[selectedThemeKey] ?: themes.firstOrNull()?.id
        val providers = parseProviders(prefs[providersKey]).map { provider ->
            provider.copy(hasApiKey = secrets.contains(OpenAiCompatibleClient.secretId(provider.id)))
        }
        UserPreferences(
            userName = prefs[userNameKey] ?: "现场工程师",
            themeMode = prefs[themeModeKey]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: ThemeMode.DARK,
            customTheme = themes.firstOrNull { it.id == selectedThemeId }?.tokens,
            themePresets = themes,
            selectedThemeId = selectedThemeId,
            aiProviders = providers,
            selectedAiProviderId = prefs[selectedProviderKey] ?: providers.firstOrNull()?.id,
            selectedAiProjectId = prefs[selectedAiProjectKey],
            selectedTechnologyIds = prefs[selectedTechnologiesKey] ?: emptySet(),
            deploymentContext = parseDeploymentContext(prefs[deploymentContextKey]),
        )
    }

    suspend fun setUserName(value: String) {
        context.dataStore.edit { it[userNameKey] = value.trim().ifBlank { "现场工程师" } }
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        context.dataStore.edit { it[themeModeKey] = mode.name }
    }

    suspend fun importTheme(json: String): ThemePreset {
        val tokens = parseTheme(json)
        val now = System.currentTimeMillis()
        val preset = ThemePreset(UUID.randomUUID().toString(), tokens, normalizeThemeJson(tokens), now, now)
        context.dataStore.edit { prefs ->
            val list = parseThemes(prefs[themesKey]).toMutableList().apply { add(preset) }
            prefs[themesKey] = encodeThemes(list)
            prefs[selectedThemeKey] = preset.id
            prefs[themeModeKey] = ThemeMode.CUSTOM.name
        }
        return preset
    }

    suspend fun updateTheme(id: String, json: String) {
        val tokens = parseTheme(json)
        context.dataStore.edit { prefs ->
            val list = parseThemes(prefs[themesKey]).map { current ->
                if (current.id == id) current.copy(tokens = tokens, sourceJson = normalizeThemeJson(tokens), updatedAt = System.currentTimeMillis()) else current
            }
            require(list.any { it.id == id }) { "主题不存在" }
            prefs[themesKey] = encodeThemes(list)
        }
    }

    suspend fun selectTheme(id: String) {
        val current = values.first()
        require(current.themePresets.any { it.id == id }) { "主题不存在" }
        context.dataStore.edit {
            it[selectedThemeKey] = id
            it[themeModeKey] = ThemeMode.CUSTOM.name
        }
    }

    suspend fun deleteTheme(id: String) {
        context.dataStore.edit { prefs ->
            val list = parseThemes(prefs[themesKey]).filterNot { it.id == id }
            prefs[themesKey] = encodeThemes(list)
            if (prefs[selectedThemeKey] == id) {
                prefs.remove(selectedThemeKey)
                prefs[themeModeKey] = ThemeMode.DARK.name
            }
        }
    }

    suspend fun saveProvider(provider: AiProvider, apiKey: String) {
        validateProvider(provider)
        val now = System.currentTimeMillis()
        val normalized = provider.copy(
            name = provider.name.trim(),
            baseUrl = provider.baseUrl.trim().trimEnd('/'),
            model = provider.model.trim(),
            timeoutSeconds = provider.timeoutSeconds.coerceIn(5, 300),
            temperature = provider.temperature.coerceIn(0.0, 2.0),
            createdAt = provider.createdAt.takeIf { it > 0 } ?: now,
            updatedAt = now,
        )
        if (apiKey.isNotBlank()) secrets.put(OpenAiCompatibleClient.secretId(provider.id), apiKey.trim())
        context.dataStore.edit { prefs ->
            val list = parseProviders(prefs[providersKey]).toMutableList()
            val index = list.indexOfFirst { it.id == provider.id }
            if (index >= 0) list[index] = normalized else list.add(normalized)
            prefs[providersKey] = encodeProviders(list)
            if (prefs[selectedProviderKey].isNullOrBlank()) prefs[selectedProviderKey] = provider.id
        }
    }

    suspend fun selectProvider(id: String) {
        require(values.first().aiProviders.any { it.id == id }) { "AI Provider 不存在" }
        context.dataStore.edit { it[selectedProviderKey] = id }
    }

    suspend fun selectAiProject(id: String) {
        context.dataStore.edit { it[selectedAiProjectKey] = id }
    }

    suspend fun deleteProvider(id: String) {
        secrets.remove(OpenAiCompatibleClient.secretId(id))
        context.dataStore.edit { prefs ->
            val list = parseProviders(prefs[providersKey]).filterNot { it.id == id }
            prefs[providersKey] = encodeProviders(list)
            if (prefs[selectedProviderKey] == id) {
                if (list.isEmpty()) prefs.remove(selectedProviderKey) else prefs[selectedProviderKey] = list.first().id
            }
        }
    }

    suspend fun setTechnologyEnabled(id: String, enabled: Boolean) {
        context.dataStore.edit { prefs ->
            val selected = (prefs[selectedTechnologiesKey] ?: emptySet()).toMutableSet()
            if (enabled) selected.add(id) else selected.remove(id)
            prefs[selectedTechnologiesKey] = selected
        }
    }

    suspend fun saveDeploymentContext(value: DeploymentContext) {
        val normalized = value.copy(
            siteName = value.siteName.trim(),
            deploymentGoal = value.deploymentGoal.trim(),
            architecture = value.architecture.trim(),
            operatingSystems = value.operatingSystems.trim(),
            serverTopology = value.serverTopology.trim(),
            networkAccess = value.networkAccess.trim(),
            baseDirectory = value.baseDirectory.trim(),
            filesAndServices = value.filesAndServices.trim(),
            runtimeAndVersions = value.runtimeAndVersions.trim(),
            dataAndBackup = value.dataAndBackup.trim(),
            constraints = value.constraints.trim(),
            updatedAt = System.currentTimeMillis(),
        )
        context.dataStore.edit { it[deploymentContextKey] = encodeDeploymentContext(normalized) }
    }

    suspend fun clearDeploymentContext() {
        context.dataStore.edit { it.remove(deploymentContextKey) }
    }

    private fun validateProvider(provider: AiProvider) {
        require(provider.name.isNotBlank()) { "Provider 名称不能为空" }
        require(provider.model.isNotBlank()) { "模型名称不能为空" }
        require(provider.baseUrl.startsWith("https://") || provider.baseUrl.startsWith("http://")) {
            "Base URL 必须以 http:// 或 https:// 开头"
        }
        require(ModelLifecycleRegistry.blockingReason(provider) == null) {
            ModelLifecycleRegistry.blockingReason(provider).orEmpty()
        }
    }

    companion object {
        fun parseThemeOrNull(json: String): ThemeTokens? = runCatching { parseTheme(json) }.getOrNull()

        fun parseTheme(json: String): ThemeTokens {
            val root = JSONObject(json)
            require(root.optInt("schemaVersion", -1) == 1) { "仅支持 schemaVersion=1 的主题" }
            fun color(key: String): Long {
                val value = root.getString(key)
                require(Regex("^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$").matches(value)) { "$key 不是有效颜色" }
                val hex = value.drop(1)
                val argb = if (hex.length == 6) "FF$hex" else hex.takeLast(2) + hex.take(6)
                return argb.toLong(16)
            }
            return ThemeTokens(
                name = root.getString("name").take(40),
                background = color("background"), surface = color("surface"),
                surfaceElevated = color("surfaceElevated"), primary = color("primary"),
                secondary = color("secondary"), success = color("success"),
                warning = color("warning"), danger = color("danger"),
                textPrimary = color("textPrimary"), textSecondary = color("textSecondary"),
                outline = color("outline"),
            )
        }

        fun normalizeThemeJson(tokens: ThemeTokens): String = JSONObject().apply {
            put("schemaVersion", 1)
            put("name", tokens.name)
            put("background", colorHex(tokens.background)); put("surface", colorHex(tokens.surface))
            put("surfaceElevated", colorHex(tokens.surfaceElevated)); put("primary", colorHex(tokens.primary))
            put("secondary", colorHex(tokens.secondary)); put("success", colorHex(tokens.success))
            put("warning", colorHex(tokens.warning)); put("danger", colorHex(tokens.danger))
            put("textPrimary", colorHex(tokens.textPrimary)); put("textSecondary", colorHex(tokens.textSecondary))
            put("outline", colorHex(tokens.outline))
        }.toString(2)

        private fun colorHex(value: Long): String = "#%08X".format((value and 0xFFFFFF) shl 8 or ((value ushr 24) and 0xFF))

        private fun parseThemes(json: String?): List<ThemePreset> = runCatching {
            val array = JSONArray(json ?: "[]")
            List(array.length()) { index ->
                val item = array.getJSONObject(index)
                val source = item.getJSONObject("theme").toString()
                ThemePreset(item.getString("id"), parseTheme(source), normalizeThemeJson(parseTheme(source)), item.optLong("createdAt"), item.optLong("updatedAt"))
            }
        }.getOrDefault(emptyList())

        private fun encodeThemes(items: List<ThemePreset>): String = JSONArray().apply {
            items.forEach { item -> put(JSONObject().put("id", item.id).put("createdAt", item.createdAt).put("updatedAt", item.updatedAt).put("theme", JSONObject(normalizeThemeJson(item.tokens)))) }
        }.toString()

        private fun parseProviders(json: String?): List<AiProvider> = runCatching {
            val array = JSONArray(json ?: "[]")
            List(array.length()) { index ->
                val item = array.getJSONObject(index)
                AiProvider(
                    id = item.getString("id"), name = item.getString("name"), baseUrl = item.getString("baseUrl"),
                    model = item.getString("model"), temperature = item.optDouble("temperature", 0.3),
                    timeoutSeconds = item.optInt("timeoutSeconds", 60), streamingEnabled = item.optBoolean("streamingEnabled", true),
                    createdAt = item.optLong("createdAt"), updatedAt = item.optLong("updatedAt"),
                    thinkingEnabled = item.optBooleanOrNull("thinkingEnabled"),
                )
            }
        }.getOrDefault(emptyList())

        private fun encodeProviders(items: List<AiProvider>): String = JSONArray().apply {
            items.forEach { item ->
                put(JSONObject().put("id", item.id).put("name", item.name).put("baseUrl", item.baseUrl).put("model", item.model)
                    .put("temperature", item.temperature).put("timeoutSeconds", item.timeoutSeconds)
                    .put("streamingEnabled", item.streamingEnabled).put("createdAt", item.createdAt).put("updatedAt", item.updatedAt)
                    .apply { item.thinkingEnabled?.let { put("thinkingEnabled", it) } })
            }
        }.toString()

        private fun JSONObject.optBooleanOrNull(key: String): Boolean? =
            if (has(key) && !isNull(key)) getBoolean(key) else null

        private fun parseDeploymentContext(json: String?): DeploymentContext = runCatching {
            val item = JSONObject(json ?: "{}")
            DeploymentContext(
                siteName = item.optString("siteName"),
                deploymentGoal = item.optString("deploymentGoal"),
                architecture = item.optString("architecture"),
                operatingSystems = item.optString("operatingSystems"),
                serverTopology = item.optString("serverTopology"),
                networkAccess = item.optString("networkAccess"),
                baseDirectory = item.optString("baseDirectory"),
                filesAndServices = item.optString("filesAndServices"),
                runtimeAndVersions = item.optString("runtimeAndVersions"),
                dataAndBackup = item.optString("dataAndBackup"),
                constraints = item.optString("constraints"),
                updatedAt = item.optLong("updatedAt"),
            )
        }.getOrDefault(DeploymentContext())

        private fun encodeDeploymentContext(value: DeploymentContext): String = JSONObject().apply {
            put("siteName", value.siteName)
            put("deploymentGoal", value.deploymentGoal)
            put("architecture", value.architecture)
            put("operatingSystems", value.operatingSystems)
            put("serverTopology", value.serverTopology)
            put("networkAccess", value.networkAccess)
            put("baseDirectory", value.baseDirectory)
            put("filesAndServices", value.filesAndServices)
            put("runtimeAndVersions", value.runtimeAndVersions)
            put("dataAndBackup", value.dataAndBackup)
            put("constraints", value.constraints)
            put("updatedAt", value.updatedAt)
        }.toString()
    }
}
