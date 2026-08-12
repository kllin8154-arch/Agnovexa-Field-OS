package com.kllin.agnovexa.fieldos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.kllin.agnovexa.fieldos.core.designsystem.AgnovexaTheme
import com.kllin.agnovexa.fieldos.presentation.FieldOsApp
import com.kllin.agnovexa.fieldos.presentation.FieldOsViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<FieldOsViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val state by viewModel.state.collectAsState()
            AgnovexaTheme(state.preferences) {
                FieldOsApp(state = state, viewModel = viewModel)
            }
        }
    }
}
