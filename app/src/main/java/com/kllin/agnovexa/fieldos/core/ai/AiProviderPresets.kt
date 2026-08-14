package com.kllin.agnovexa.fieldos.core.ai

data class AiProviderPreset(
    val id: String,
    val name: String,
    val baseUrl: String,
    val models: List<String>,
    val hint: String,
)

object AiProviderPresets {
    val all = listOf(
        AiProviderPreset("deepseek", "DeepSeek", "https://api.deepseek.com/v1", listOf("deepseek-v4-flash", "deepseek-v4-pro"), "官方 Chat Completions；V4 默认开启 Thinking"),
        AiProviderPreset("qwen", "阿里云百炼 · 通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1", listOf("qwen3.7-plus", "qwen-plus", "qwen-turbo"), "推荐 qwen3.7-plus；qwen-turbo 将于 2026-10-10 停用"),
        AiProviderPreset("kimi", "Kimi · 月之暗面", "https://api.moonshot.cn/v1", listOf("kimi-k2.6"), "Kimi 开放平台 Chat Completions"),
        AiProviderPreset("glm", "智谱 GLM", "https://open.bigmodel.cn/api/paas/v4", listOf("glm-5.2", "glm-4.5-air"), "智谱通用 API；Coding Plan 请使用专属地址"),
        AiProviderPreset("siliconflow", "硅基流动 SiliconFlow", "https://api.siliconflow.cn/v1", listOf("Qwen/Qwen2.5-72B-Instruct", "Pro/deepseek-ai/DeepSeek-R1"), "模型较多，也可手工填写平台模型 ID"),
        AiProviderPreset("openai", "OpenAI", "https://api.openai.com/v1", listOf("gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"), "OpenAI 官方生产模型；离线快照核验于 2026-08-11"),
        AiProviderPreset("custom", "自定义 OpenAI-compatible", "", emptyList(), "支持私有部署、局域网模型和其他兼容服务"),
    )
}
