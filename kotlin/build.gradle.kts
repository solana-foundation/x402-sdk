plugins {
    kotlin("jvm") version "2.3.21"
    application
}

group = "org.x402"
version = "0.0.0-local"

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("com.google.code.gson:gson:2.13.2")

    testImplementation(kotlin("test"))
}

application {
    mainClass.set("org.x402.sdk.interop.InteropClientKt")
}

tasks.test {
    useJUnitPlatform()
}

tasks.register<JavaExec>("runInteropClient") {
    group = "verification"
    description = "Runs the disabled Kotlin x402 exact interop client scaffold."
    classpath = sourceSets.main.get().runtimeClasspath
    mainClass.set("org.x402.sdk.interop.InteropClientKt")
}

