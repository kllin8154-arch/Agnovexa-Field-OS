package com.kllin.agnovexa.fieldos.presentation

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FieldLayoutPolicyTest {
    @Test
    fun `窄屏使用紧凑布局`() {
        assertTrue(FieldLayoutPolicy.isCompact(widthDp = 320f, fontScale = 1f))
    }

    @Test
    fun `大字体使用紧凑布局`() {
        assertTrue(FieldLayoutPolicy.isCompact(widthDp = 412f, fontScale = 1.3f))
    }

    @Test
    fun `常规手机宽度保持平衡布局`() {
        assertFalse(FieldLayoutPolicy.isCompact(widthDp = 360f, fontScale = 1.15f))
    }
}
