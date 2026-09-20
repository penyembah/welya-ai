$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..
"rust: " + ((cargo --version 2>&1) -join " ")
"rustc: " + ((rustc --version 2>&1) -join " ")
"remote: " + ((git remote get-url origin 2>&1) -join " ")
$msvc = Get-ChildItem "C:\Program Files*\Microsoft Visual Studio\*\*\VC\Tools\MSVC" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
"msvc: " + ($(if ($msvc) { $msvc.FullName } else { "not found" }))
"webview2: " + [bool](Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue)
