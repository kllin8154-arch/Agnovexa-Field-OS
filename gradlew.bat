@echo off
setlocal
set APP_HOME=%~dp0
if defined JAVA_HOME goto useJavaHome
set JAVA_EXE=java.exe
goto execute
:useJavaHome
set JAVA_EXE=%JAVA_HOME%\bin\java.exe
:execute
"%JAVA_EXE%" -Xmx64m -Xms64m -classpath "%APP_HOME%gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
endlocal
