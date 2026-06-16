# -----------------------------
# STA AUTO-RESTART
# -----------------------------
if ($host.Runspace.ApartmentState -ne "STA") {
    Write-Host "Restarting in STA mode..." -ForegroundColor Yellow
    powershell.exe -sta -file $PSCommandPath
    return
}

# Load forms assembly for clipboard access
Add-Type -AssemblyName System.Windows.Forms
# -----------------------------
# COMMAND EXECUTION (FIXED)
# -----------------------------
function Invoke-AgentCommand {
    param([string]$CommandText)

    try {
        # EXECUTE WITHOUT STRING RE-EVALUATION
        $sb = [scriptblock]::Create($CommandText)
        $result = & $sb *>&1 | Out-String
        return $result
    }
    catch {
        return "ERROR: " + $_.Exception.Message
    }
}

# -----------------------------
# MAIN LOOP
# -----------------------------
# Load consolidated tools
$toolsPath = Join-Path $PSScriptRoot 'tools.ps1'
if (Test-Path $toolsPath) { . $toolsPath; Write-Host 'Bridge Tools loaded OK' -ForegroundColor Green } else { Write-Host 'WARNING: tools.ps1 not found' -ForegroundColor Yellow }

$script:ActiveTokens = @{}
$lastId = -1
Write-Host 'Agent listener ACTIVE (Multi-Window Protocol v1)' -ForegroundColor Cyan

while ($true) {
    Start-Sleep -Milliseconds 500

    try {
        if (-not [System.Windows.Forms.Clipboard]::ContainsText()) { continue }

        $clip = [System.Windows.Forms.Clipboard]::GetText()
        if ([string]::IsNullOrWhiteSpace($clip)) { continue }

        # --- 1. HANDLE HANDSHAKE REQUEST ---
        if ($clip -match "\[HANDSHAKE_REQ\]") {
            $start = $clip.IndexOf("[HANDSHAKE_REQ]") + 15
            $end   = $clip.IndexOf("[/HANDSHAKE_REQ]")
            if ($start -ge 15 -and $end -gt $start) {
                $json = $clip.Substring($start, $end - $start).Trim()
                try { 
                    $hData = $json | ConvertFrom-Json 
                    if ($hData.sender -eq "browser" -and $hData.action -eq "register") {
                        $cId = $hData.client
                        $newToken = Get-Random -Minimum 1000 -Maximum 9999
                        $script:ActiveTokens[$newToken] = $true
                        
                        $ack = @{
                            sender = "powershell"
                            action = "assign"
                            token  = $newToken
                            client = $cId
                        } | ConvertTo-Json -Compress
                        
                        $wrappedAck = "[HANDSHAKE_ACK]`n$ack`n[/HANDSHAKE_ACK]"
                        [System.Windows.Forms.Clipboard]::SetText($wrappedAck)
                        Write-Host "HANDSHAKE: Assigned Token $newToken to Client $cId" -ForegroundColor Cyan
                        continue
                    }
                } catch { }
            }
        }

        # --- 2. HANDLE AGENT COMMANDS ---
        if ($clip -notmatch "\[AGENT_CMD\]") { continue }

        $start = $clip.IndexOf("[AGENT_CMD]") + 11
        $end   = $clip.IndexOf("[/AGENT_CMD]")
        if ($start -lt 0 -or $end -le $start) { continue }

        $json = $clip.Substring($start, $end - $start).Trim()

        try { $data = $json | ConvertFrom-Json } catch { continue }

        # Security & ID checks
        if ($data.sender -ne "br") { continue }
        if ($data.id -eq $lastId) { continue }
        
        # Token check
        if (-not $script:ActiveTokens.ContainsKey($data.token)) {
            Write-Host "REJECTED: Unknown Token $($data.token) (Listener likely restarted)" -ForegroundColor Red
            
            # Send Reset Signal to Extension
            $resetRes = @{
                p = "agent1"
                sender = "ps"
                id = $data.id
                status = "error"
                result = "INVALID_TOKEN"
            } | ConvertTo-Json -Compress
            $wrappedReset = "[AGENT_RES]`n$resetRes`n[/AGENT_RES]"
            [System.Windows.Forms.Clipboard]::SetText($wrappedReset)
            continue
        }

        $lastId = $data.id
        $currentSessionToken = $data.token

        # Decode command
        if ($data.encoding -eq "base64") {
            $bytes = [System.Convert]::FromBase64String($data.cmd)
            $cmdToRun = [System.Text.Encoding]::UTF8.GetString($bytes)
        } else {
            $cmdToRun = $data.cmd
        }

        # SECURITY: Clear clipboard immediately after reading to avoid lingering tokens
        [System.Windows.Forms.Clipboard]::Clear()

        Write-Host "EXECUTE ID $($data.id) [Token $currentSessionToken]: $cmdToRun" -ForegroundColor Yellow

        try {
            $result = Invoke-AgentCommand -CommandText $cmdToRun
        } catch {
            $result = "Error: " + $_.Exception.Message
        }

        if ([string]::IsNullOrWhiteSpace($result)) {
            $result = "Done (no output)"
        } else {
            $result = $result.Trim()
            # Truncate large results to avoid paste failures
            if ($result.Length -gt 3000) {
                $result = $result.Substring(0, 3000) + '[TRUNCATED]'
            }
        }

        $response = @{
            p = "agent1"
            sender = "ps"
            token  = $currentSessionToken
            id = $data.id
            status = "done"
            result = $result
        } | ConvertTo-Json -Compress

        $wrapped = "[AGENT_RES]`n$response`n[/AGENT_RES]"

        for ($i = 0; $i -lt 5; $i++) {
            try {
                [System.Windows.Forms.Clipboard]::SetText($wrapped)
                break
            } catch {
                Start-Sleep -Milliseconds 200
            }
        }

        Write-Host "SENT ID: $($data.id) (Token: $currentSessionToken)" -ForegroundColor Green
        Write-Host "--------------------"

    } catch {
        continue
    }
}
