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

    @Test
    fun `平板宽度使用常驻侧边栏`() {
        assertTrue(FieldLayoutPolicy.usesPermanentNavigation(widthDp = 840f, fontScale = 1f))
    }

    @Test
    fun `手机和大字体平板保留可收起侧边栏`() {
        assertFalse(FieldLayoutPolicy.usesPermanentNavigation(widthDp = 375f, fontScale = 1f))
        assertFalse(FieldLayoutPolicy.usesPermanentNavigation(widthDp = 768f, fontScale = 1f))
        assertFalse(FieldLayoutPolicy.usesPermanentNavigation(widthDp = 900f, fontScale = 1.3f))
    }

    @Test
    fun `桌面级宽度保持常驻侧边栏`() {
        assertTrue(FieldLayoutPolicy.usesPermanentNavigation(widthDp = 1024f, fontScale = 1f))
    }
}
