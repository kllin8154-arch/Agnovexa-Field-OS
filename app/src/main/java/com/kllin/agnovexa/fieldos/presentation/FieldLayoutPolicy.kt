package com.kllin.agnovexa.fieldos.presentation

internal object FieldLayoutPolicy {
    fun isCompact(widthDp: Float, fontScale: Float): Boolean = widthDp < 360f || fontScale >= 1.2f
}
