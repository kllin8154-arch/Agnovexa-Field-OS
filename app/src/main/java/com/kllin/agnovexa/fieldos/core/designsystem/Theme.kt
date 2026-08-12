package com.kllin.agnovexa.fieldos.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.domain.ThemeMode
import com.kllin.agnovexa.fieldos.domain.ThemeTokens
import com.kllin.agnovexa.fieldos.domain.UserPreferences

object AppColors {
    val Background = Color(0xFF08090B)
    val Surface = Color(0xFF111317)
    val SurfaceElevated = Color(0xFF181B20)
    val Primary = Color(0xFFD9FF72)
    val Secondary = Color(0xFF91FFD7)
    val Success = Color(0xFF91FFD7)
    val Warning = Color(0xFFFFCF70)
    val Danger = Color(0xFFFF8C8C)
    val TextPrimary = Color(0xFFF5F5EF)
    val TextSecondary = Color(0xFFC1C5CE)
    val Outline = Color(0xFF3A3E46)
}

object AppSpacing {
    val xxs = 4.dp
    val xs = 8.dp
    val sm = 12.dp
    val md = 16.dp
    val lg = 24.dp
    val xl = 32.dp
}

object AppShapes {
    val small = RoundedCornerShape(12.dp)
    val medium = RoundedCornerShape(18.dp)
    val large = RoundedCornerShape(28.dp)
}

private val DarkColors = darkColorScheme(
    primary = AppColors.Primary, secondary = AppColors.Secondary,
    background = AppColors.Background, surface = AppColors.Surface,
    surfaceVariant = AppColors.SurfaceElevated, error = AppColors.Danger,
    primaryContainer = Color(0xFF2A330D), onPrimaryContainer = AppColors.Primary,
    secondaryContainer = Color(0xFF12362C), onSecondaryContainer = AppColors.Secondary,
    onPrimary = Color(0xFF151B03), onBackground = AppColors.TextPrimary,
    onSurface = AppColors.TextPrimary, onSurfaceVariant = AppColors.TextSecondary,
    outline = AppColors.Outline,
)

private val LightColors = lightColorScheme(
    primary = Color(0xFF527400), secondary = Color(0xFF006B55),
    background = Color(0xFFF6F7F2), surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFE9ECE3), error = Color(0xFFBA1A1A),
    onPrimary = Color.White, onBackground = Color(0xFF171912),
    onSurface = Color(0xFF171912), onSurfaceVariant = Color(0xFF5D6256),
    outline = Color(0xFFC2C7BA),
)

private val AgnovexaTypography = Typography(
    displayLarge = TextStyle(fontSize = 42.sp, lineHeight = 46.sp, fontWeight = FontWeight.Medium, letterSpacing = (-1.2).sp),
    displayMedium = TextStyle(fontSize = 34.sp, lineHeight = 38.sp, fontWeight = FontWeight.Medium, letterSpacing = (-.9).sp),
    headlineLarge = TextStyle(fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.Medium, letterSpacing = (-.7).sp),
    headlineMedium = TextStyle(fontSize = 25.sp, lineHeight = 30.sp, fontWeight = FontWeight.Medium, letterSpacing = (-.45).sp),
    titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-.2).sp),
    titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 23.sp, fontWeight = FontWeight.Normal),
    bodyMedium = TextStyle(fontSize = 13.sp, lineHeight = 20.sp, fontWeight = FontWeight.Normal),
    labelLarge = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
    labelSmall = TextStyle(fontSize = 10.sp, lineHeight = 14.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.25.sp),
)

private val AgnovexaShapes = Shapes(
    small = AppShapes.small,
    medium = AppShapes.medium,
    large = AppShapes.large,
)

private fun contrastRatio(first: Color, second: Color): Float {
    val lighter = maxOf(first.luminance(), second.luminance())
    val darker = minOf(first.luminance(), second.luminance())
    return (lighter + .05f) / (darker + .05f)
}

private fun readableColor(preferred: Color, backgrounds: List<Color>, minimumRatio: Float = 4.5f): Color {
    if (backgrounds.all { contrastRatio(preferred, it) >= minimumRatio }) return preferred
    val light = Color(0xFFF8FAF5)
    val dark = Color(0xFF11130E)
    val lightRatio = backgrounds.minOf { contrastRatio(light, it) }
    val darkRatio = backgrounds.minOf { contrastRatio(dark, it) }
    return if (lightRatio >= darkRatio) light else dark
}

private fun ThemeTokens.toColorScheme(): ColorScheme {
    val primaryColor = Color(primary)
    val backgroundColor = Color(background)
    val surfaceColor = Color(surface)
    val elevatedColor = Color(surfaceElevated)
    return darkColorScheme(
        primary = primaryColor,
        secondary = Color(secondary),
        background = backgroundColor,
        surface = surfaceColor,
        surfaceVariant = elevatedColor,
        error = Color(danger),
        onPrimary = readableColor(Color(textPrimary), listOf(primaryColor)),
        onBackground = readableColor(Color(textPrimary), listOf(backgroundColor)),
        onSurface = readableColor(Color(textPrimary), listOf(surfaceColor)),
        onSurfaceVariant = readableColor(Color(textSecondary), listOf(backgroundColor, surfaceColor, elevatedColor)),
        outline = Color(outline),
    )
}

@Composable
fun AgnovexaTheme(preferences: UserPreferences, content: @Composable () -> Unit) {
    val systemDark = isSystemInDarkTheme()
    val colors = when (preferences.themeMode) {
        ThemeMode.DARK -> DarkColors
        ThemeMode.LIGHT -> LightColors
        ThemeMode.SYSTEM -> if (systemDark) DarkColors else LightColors
        ThemeMode.CUSTOM -> preferences.customTheme?.toColorScheme() ?: DarkColors
    }
    MaterialTheme(
        colorScheme = colors,
        typography = AgnovexaTypography,
        shapes = AgnovexaShapes,
        content = content,
    )
}
