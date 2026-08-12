package com.kllin.agnovexa.fieldos.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class CommandRiskClassifierTest {
    @Test fun safeQueryIsSafe() {
        assertEquals("SAFE", CommandRiskClassifier.classify("systemctl status nginx"))
    }

    @Test fun recursiveDeleteIsDangerous() {
        assertEquals("DANGEROUS", CommandRiskClassifier.classify("sudo rm   -rf /tmp/demo"))
    }

    @Test fun serviceRestartRequiresCaution() {
        assertEquals("CAUTION", CommandRiskClassifier.classify("systemctl restart nginx"))
    }
}
