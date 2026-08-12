package com.kllin.agnovexa.fieldos.presentation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kllin.agnovexa.fieldos.R
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

@Composable
fun AgnovexaBootSequence(onFinished: () -> Unit) {
    val progress = remember { Animatable(0f) }
    val orbitLineColor = MaterialTheme.colorScheme.onBackground
    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary
    val orbitTransition = rememberInfiniteTransition(label = "启动轨道")
    val orbitAngle by orbitTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4_800),
            repeatMode = RepeatMode.Restart,
        ),
        label = "轨道角度",
    )
    val glow by orbitTransition.animateFloat(
        initialValue = .55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1_700, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "品牌光晕",
    )

    LaunchedEffect(Unit) {
        progress.animateTo(1f, animationSpec = tween(2_650, easing = FastOutSlowInEasing))
        delay(280)
        onFinished()
    }

    val status = when {
        progress.value < .24f -> "正在唤醒离线核心"
        progress.value < .5f -> "正在装载项目与本地索引"
        progress.value < .74f -> "正在恢复偏好与 Agent 上下文"
        progress.value < .96f -> "正在检查工作区状态"
        else -> "工作空间已就绪"
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        val compactHeight = maxHeight < 560.dp
        BootBackdrop()
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth()
                .padding(horizontal = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.size(if (compactHeight) 132.dp else 190.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) {
                    val center = Offset(size.width / 2f, size.height / 2f)
                    listOf(.48f, .36f, .25f).forEachIndexed { index, factor ->
                        val radius = size.minDimension * factor
                        drawCircle(
                            color = orbitLineColor.copy(alpha = .08f + index * .018f),
                            radius = radius,
                            center = center,
                            style = Stroke(width = 1.dp.toPx()),
                        )
                    }
                    listOf(.48f to primaryColor, .36f to secondaryColor).forEachIndexed { index, item ->
                        val radius = size.minDimension * item.first
                        val direction = if (index == 0) 1f else -.82f
                        val radians = Math.toRadians((orbitAngle * direction + index * 110f).toDouble())
                        val dot = Offset(
                            x = center.x + cos(radians).toFloat() * radius,
                            y = center.y + sin(radians).toFloat() * radius,
                        )
                        drawCircle(item.second.copy(alpha = .18f * glow), 12.dp.toPx(), dot)
                        drawCircle(item.second, 4.5.dp.toPx(), dot)
                    }
                }
                Box(
                    modifier = Modifier
                        .size(82.dp)
                        .background(
                            brush = Brush.linearGradient(
                                listOf(orbitLineColor.copy(alpha = .13f), orbitLineColor.copy(alpha = .035f)),
                            ),
                            shape = RoundedCornerShape(25.dp),
                        )
                        .border(1.dp, orbitLineColor.copy(alpha = .17f), RoundedCornerShape(25.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_launcher_foreground),
                        contentDescription = null,
                        tint = Color.Unspecified,
                        modifier = Modifier.size(72.dp),
                    )
                }
            }
            Spacer(Modifier.height(if (compactHeight) 14.dp else 34.dp))
            Text(
                "PERSONAL FIELD INTELLIGENCE SYSTEM",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 10.sp,
                letterSpacing = 2.8.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(if (compactHeight) 7.dp else 14.dp))
            Text(
                "AGNOVEXA",
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = if (compactHeight) 31.sp else 40.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 5.sp,
            )
            Spacer(Modifier.height(if (compactHeight) 5.dp else 10.dp))
            Text(
                "FIELD OS / LOCAL-FIRST WORKSPACE",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 10.sp,
                letterSpacing = 2.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(if (compactHeight) 18.dp else 54.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = FontFamily.Monospace, fontSize = 11.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.size(8.dp))
                Text("${(progress.value * 100).roundToInt().toString().padStart(2, '0')}%", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
            }
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
                progress = { progress.value },
                modifier = Modifier.fillMaxWidth().height(2.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.onBackground.copy(alpha = .08f),
            )
        }
        TextButton(
            onClick = onFinished,
            modifier = Modifier.align(Alignment.BottomEnd).padding(18.dp),
        ) {
            Text("跳过启动动画", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
    }
}

@Composable
private fun BootBackdrop() {
    val gridColor = MaterialTheme.colorScheme.onBackground.copy(alpha = .022f)
    val glowColor = MaterialTheme.colorScheme.primary.copy(alpha = .07f)
    Canvas(Modifier.fillMaxSize()) {
        val grid = 52.dp.toPx()
        var x = 0f
        while (x <= size.width) {
            drawLine(gridColor, Offset(x, 0f), Offset(x, size.height), 1f)
            x += grid
        }
        var y = 0f
        while (y <= size.height) {
            drawLine(gridColor, Offset(0f, y), Offset(size.width, y), 1f)
            y += grid
        }
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(glowColor, Color.Transparent),
                center = Offset(size.width * .5f, size.height * .42f),
                radius = size.minDimension * .72f,
            ),
            radius = size.minDimension * .72f,
            center = Offset(size.width * .5f, size.height * .42f),
        )
    }
}
