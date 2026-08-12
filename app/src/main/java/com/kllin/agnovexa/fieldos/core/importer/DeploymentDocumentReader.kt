package com.kllin.agnovexa.fieldos.core.importer

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.kllin.agnovexa.fieldos.domain.DeploymentDocumentParser
import com.kllin.agnovexa.fieldos.domain.DeploymentImportDraft
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.charset.Charset
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class DeploymentDocumentReader @Inject constructor(
    @param:ApplicationContext private val context: Context,
) {
    suspend fun read(uri: Uri): DeploymentImportDraft = withContext(Dispatchers.IO) {
        val name = displayName(uri)
        require(name.substringAfterLast('.', "").lowercase() in SUPPORTED_EXTENSIONS) {
            "仅支持 Markdown、TXT 和 JSON 部署文档"
        }
        val bytes = context.contentResolver.openInputStream(uri)?.use(::readLimited)
            ?: error("无法读取部署文档")
        DeploymentDocumentParser.parse(name, decode(bytes))
    }

    private fun displayName(uri: Uri): String {
        val fromProvider = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
        return fromProvider ?: uri.lastPathSegment ?: "deployment.md"
    }

    private fun readLimited(input: java.io.InputStream): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8 * 1024)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            require(output.size() + count <= MAX_BYTES) { "部署文档不能超过 2 MB" }
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }

    private fun decode(bytes: ByteArray): String = runCatching {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes)).toString()
    }.getOrElse {
        Charset.forName("GB18030").decode(ByteBuffer.wrap(bytes)).toString()
    }.removePrefix("\uFEFF")

    private companion object {
        const val MAX_BYTES = 2 * 1024 * 1024
        val SUPPORTED_EXTENSIONS = setOf("md", "markdown", "txt", "json")
    }
}
